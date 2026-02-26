import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, resolveStageName, fetchCompaniesByIds, formatDate } from '../services/api.js';
import { Deal, ApiListResponse } from '../types.js';
import { buildIncludeFields, formatIncludedRelations } from '../services/relations.js';

export const dealTools = {
  zero_list_deals: {
    description: 'List deals in Zero CRM with optional filtering and pagination. Stages are IDs, not names — use zero_list_pipeline_stages to look up stage IDs first. Company location (city, country) is automatically included in the response. Use "include" to fetch related data inline (e.g., ["tasks", "contacts", "notes"]). To filter deals by company attributes (e.g., location, industry, size), first use zero_list_companies with the appropriate filter to find matching company IDs, then filter deals with {"companyId": {"$in": [...]}}. Filter examples: {"stage": "<stage_id>"}, {"value": {"$gte": 50000}}, {"value": {"$between": [1000, 5000]}}, {"closeDate:month": "2026-01"}, {"stage": {"$in": ["id1", "id2"]}}, {"ownerIds": {"$includes": "userId"}}, {"companyId": {"$in": ["id1", "id2"]}}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions using $-prefixed operators (e.g., {"value": {"$gte": 50000}}, {"stage": {"$in": ["id1", "id2"]}}, {"closeDate:month": "2026-01"})'),
      limit: z.number().int().min(1).max(1000).optional().default(20).describe('Max records to return (default: 20, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (min: 0)'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"value": "desc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      includeRelations: z.boolean().optional().default(true).describe('Include company details (legacy, prefer "include" param)'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: company, contacts, tasks, notes, emailThreads, calendarEvents, activities, issues, comments'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string; includeRelations?: boolean; include?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const hasInclude = args.include && args.include.length > 0;
        const includeHasCompany = hasInclude && args.include!.includes('company');

        let fields = args.fields;
        if (hasInclude) {
          if (!fields) {
            fields = 'id,name,value,stage,confidence,closeDate,companyId,createdAt,updatedAt';
          }
          fields = buildIncludeFields('deal', args.include!, fields);
        } else if (args.includeRelations !== false && !fields) {
          fields = 'id,name,value,stage,confidence,closeDate,companyId,company.id,company.name,createdAt,updatedAt';
        }

        const params = buildQueryParams({
          workspaceId,
          where: args.where,
          limit: args.limit || 20,
          offset: args.offset || 0,
          orderBy: args.orderBy,
          fields,
        });

        const response = await client.get<ApiListResponse<Deal>>('/api/deals', { params });
        const deals = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + deals.length < total : deals.length === limit;

        if (deals.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No deals found matching your criteria.',
            }],
          };
        }

        const formatValue = (deal: Deal) => {
          if (deal.value == null) return 'N/A';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(deal.value);
        };

        // Resolve stage names and optionally enrich company details in parallel
        // Skip fetchCompaniesByIds when include has "company" (already fetched via fields)
        const companyIds = deals.map((d) => d.companyId).filter(Boolean) as string[];
        const shouldFetchCompanies = !includeHasCompany && args.includeRelations !== false;
        const [stageResults, companyMap] = await Promise.all([
          Promise.allSettled(deals.map((d) => resolveStageName(d.stage))),
          shouldFetchCompanies ? fetchCompaniesByIds(companyIds) : Promise.resolve(new Map()),
        ]);
        // Extract stage names with fallback to stage ID on failure
        const stageNames = stageResults.map((result, i) =>
          result.status === 'fulfilled' ? result.value : deals[i].stage
        );

        const formatCompany = (deal: Deal) => {
          const enriched = deal.companyId ? companyMap.get(deal.companyId) : undefined;
          const name = enriched?.name || deal.company?.name;
          if (!name) return 'N/A';
          const location = [enriched?.city, enriched?.country].filter(Boolean).join(', ');
          return location ? `${name} (${location})` : name;
        };

        const formatConfidence = (confidence: number | undefined) => {
          if (confidence == null) return 'N/A';
          return `${Math.round(confidence * 100)}%`;
        };

        const markdown = `## Deals (${deals.length}${total ? ` of ${total}` : ''})

${deals.map((d, i) => {
  let entry = `### ${i + 1}. ${d.name}
- **ID:** ${d.id}
- **Value:** ${formatValue(d)}
- **Stage:** ${stageNames[i]}
- **Confidence:** ${formatConfidence(d.confidence)}
- **Close Date:** ${d.closeDate ? formatDate(d.closeDate, 'date') : 'N/A'}
- **Company:** ${includeHasCompany ? (d.company?.name || 'N/A') : formatCompany(d)}
`;
  if (hasInclude) {
    entry += formatIncludedRelations('deal', d as unknown as Record<string, unknown>, args.include!);
  }
  return entry;
}).join('\n')}
${hasMore ? `\n*More results available. Use offset=${offset + limit} to see next page.*` : ''}`;

        return {
          content: [{
            type: 'text' as const,
            text: markdown,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error listing deals: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_deal: {
    description: 'Get a single deal by ID with full details. Use "include" to fetch related data inline (e.g., ["tasks", "contacts", "notes"]).',
    inputSchema: z.object({
      id: z.string().uuid().describe('The deal ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: company, contacts, tasks, notes, emailThreads, calendarEvents, activities, issues, comments'),
    }),
    handler: async (args: { id: string; fields?: string; include?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const hasInclude = args.include && args.include.length > 0;
        const includeHasCompany = hasInclude && args.include!.includes('company');

        let fields = args.fields;
        if (hasInclude) {
          if (!fields) {
            fields = 'id,name,value,stage,confidence,closeDate,startDate,endDate,companyId,contactIds,ownerIds,archived,createdAt,updatedAt';
          }
          fields = buildIncludeFields('deal', args.include!, fields);
        } else if (!fields) {
          fields = 'id,name,value,stage,confidence,closeDate,startDate,endDate,companyId,company.id,company.name,contactIds,ownerIds,archived,createdAt,updatedAt';
        }

        const params: Record<string, string> = { workspaceId };
        if (fields) params.fields = fields;

        const response = await client.get<{ data: Deal }>(`/api/deals/${args.id}`, { params });
        const deal = response.data.data;

        const formatValue = (d: Deal) => {
          if (d.value == null) return 'N/A';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d.value);
        };

        // Skip fetchCompaniesByIds when include has "company"
        const shouldFetchCompany = !includeHasCompany && deal.companyId;
        const [stageResult, companyMap] = await Promise.all([
          resolveStageName(deal.stage).then(value => ({ status: 'fulfilled' as const, value })).catch(() => ({ status: 'rejected' as const, value: deal.stage })),
          shouldFetchCompany ? fetchCompaniesByIds([deal.companyId!]) : Promise.resolve(new Map()),
        ]);
        const stageName = stageResult.status === 'fulfilled' ? stageResult.value : stageResult.value;

        const enrichedCompany = deal.companyId ? companyMap.get(deal.companyId) : undefined;
        const companyName = enrichedCompany?.name || deal.company?.name;
        const companyLocation = [enrichedCompany?.city, enrichedCompany?.country].filter(Boolean).join(', ');

        const formatConfidence = (confidence: number | undefined) => {
          if (confidence == null) return 'N/A';
          return `${Math.round(confidence * 100)}%`;
        };

        let markdown = `## ${deal.name}

**ID:** ${deal.id}
**Value:** ${formatValue(deal)}
**Stage:** ${stageName}
**Confidence:** ${formatConfidence(deal.confidence)}
**Close Date:** ${deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'N/A'}

### Company
${companyName ? `**${companyName}** (${deal.company?.id || deal.companyId})${companyLocation ? `\n**Location:** ${companyLocation}` : ''}` : 'No company associated'}

### Timestamps
- **Created:** ${formatDate(deal.createdAt)}
- **Updated:** ${formatDate(deal.updatedAt)}
${deal.archived ? '- **Archived:** yes' : ''}`;

        if (hasInclude) {
          markdown += formatIncludedRelations('deal', deal as unknown as Record<string, unknown>, args.include!);
        }

        return {
          content: [{
            type: 'text' as const,
            text: markdown,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error getting deal: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_create_deal: {
    description: 'Create a new deal in Zero CRM. Use "custom" for custom properties (use zero_list_columns to find field IDs first).',
    inputSchema: z.object({
      name: z.string().describe('Deal name (required)'),
      value: z.number().optional().describe('Deal value'),
      stage: z.string().optional().describe('Pipeline stage ID. Use zero_list_pipeline_stages to look up valid stage IDs.'),
      pipelineId: z.string().optional().describe('Pipeline ID (if multiple pipelines exist)'),
      confidence: z.number().min(0).max(1).optional().describe('Confidence as decimal between 0 and 1 (e.g., 0.60 for 60%)'),
      closeDate: z.string().optional().describe('Close date (ISO format)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs to associate with'),
      listIds: z.array(z.string()).optional().describe('List IDs to add the deal to'),
      ownerIds: z.array(z.string()).optional().describe('Owner user IDs'),
      custom: z.record(z.unknown()).optional().describe('Custom properties (use column IDs as keys)'),
      externalId: z.string().optional().describe('External system ID'),
      source: z.string().optional().describe('Source of the deal record'),
    }),
    handler: async (args: { name: string; value?: number; stage?: string; pipelineId?: string; confidence?: number; closeDate?: string; companyId?: string; contactIds?: string[]; [key: string]: unknown }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const response = await client.post<Deal>('/api/deals', {
          ...args,
          workspaceId,
        });

        const deal = response.data;

        const formatValue = (d: Deal) => {
          if (d.value == null) return 'N/A';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d.value);
        };

        const stageName = await resolveStageName(deal.stage);

        return {
          content: [{
            type: 'text' as const,
            text: `## Deal Created Successfully

**Name:** ${deal.name}
**ID:** ${deal.id}
**Value:** ${formatValue(deal)}
**Stage:** ${stageName}
**Created:** ${formatDate(deal.createdAt)}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error creating deal: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_update_deal: {
    description: 'Update an existing deal in Zero CRM. Use "custom" for custom properties (use zero_list_columns to find field IDs first).',
    inputSchema: z.object({
      id: z.string().uuid().describe('The deal ID to update'),
      name: z.string().optional().describe('Deal name'),
      value: z.number().optional().describe('Deal value'),
      stage: z.string().optional().describe('Pipeline stage ID. Use zero_list_pipeline_stages to look up valid stage IDs.'),
      pipelineId: z.string().optional().describe('Pipeline ID'),
      confidence: z.number().min(0).max(1).optional().describe('Confidence as decimal between 0 and 1 (e.g., 0.60 for 60%)'),
      closeDate: z.string().optional().describe('Close date (ISO format)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs to associate with'),
      listIds: z.array(z.string()).optional().describe('List IDs'),
      ownerIds: z.array(z.string()).optional().describe('Owner user IDs'),
      custom: z.record(z.unknown()).optional().describe('Custom properties (use column IDs as keys)'),
      externalId: z.string().optional().describe('External system ID'),
      source: z.string().optional().describe('Source of the deal record'),
    }),
    handler: async (args: { id: string; name?: string; value?: number; stage?: string; confidence?: number; closeDate?: string; companyId?: string; contactIds?: string[]; [key: string]: unknown }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const { id, ...updateData } = args;

        const response = await client.patch<Deal>(`/api/deals/${id}`, {
          ...updateData,
          workspaceId,
        });

        const deal = response.data;

        const stageName = await resolveStageName(deal.stage);

        return {
          content: [{
            type: 'text' as const,
            text: `## Deal Updated Successfully

**Name:** ${deal.name}
**ID:** ${deal.id}
**Stage:** ${stageName}
**Updated:** ${formatDate(deal.updatedAt)}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error updating deal: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_delete_deal: {
    description: 'Delete or archive a deal in Zero CRM.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The deal ID to delete'),
      archive: z.boolean().optional().default(true).describe('If true, soft delete (archive). If false, permanently delete.'),
    }),
    handler: async (args: { id: string; archive?: boolean }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.archive !== false) {
          params.archive = 'true';
        }

        await client.delete(`/api/deals/${args.id}`, { params });

        const action = args.archive !== false ? 'archived' : 'permanently deleted';

        return {
          content: [{
            type: 'text' as const,
            text: `Deal ${args.id} has been ${action}.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error deleting deal: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
