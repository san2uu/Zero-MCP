import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, resolveStageName } from '../services/api.js';
import { Deal, ApiListResponse } from '../types.js';

export const dealTools = {
  zero_list_deals: {
    description: 'List deals in Zero CRM with optional filtering and pagination. Stages are IDs, not names — use zero_list_pipeline_stages to look up stage IDs first. Filter examples: {"stage": "<stage_id>"}, {"value": {"$gte": 50000}}, {"value": {"$between": [1000, 5000]}}, {"closeDate:month": "2026-01"}, {"stage": {"$in": ["id1", "id2"]}}, {"ownerIds": {"$includes": "userId"}}, {"companyId": {"$in": ["id1", "id2"]}}. To filter deals by company attributes (e.g., location, industry, size), first use zero_list_companies with the appropriate filter to find matching company IDs, then filter deals with {"companyId": {"$in": [...]}}. Company location data (country, city) is included in the response for reference.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions using $-prefixed operators (e.g., {"value": {"$gte": 50000}}, {"stage": {"$in": ["id1", "id2"]}}, {"closeDate:month": "2026-01"})'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"value": "desc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      includeRelations: z.boolean().optional().default(true).describe('Include company details'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string; includeRelations?: boolean }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.includeRelations !== false && !fields) {
          fields = 'id,name,value,stage,confidence,closeDate,companyId,company.id,company.name,company.country,company.city,createdAt,updatedAt';
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

        // Resolve stage names for all deals
        const stageNames = await Promise.all(
          deals.map((d) => resolveStageName(d.stage))
        );

        const markdown = `## Deals (${deals.length}${total ? ` of ${total}` : ''})

${deals.map((d, i) => `### ${i + 1}. ${d.name}
- **ID:** ${d.id}
- **Value:** ${formatValue(d)}
- **Stage:** ${stageNames[i]}
- **Confidence:** ${d.confidence ? `${Math.round(parseFloat(d.confidence) * 100)}%` : 'N/A'}
- **Close Date:** ${d.closeDate ? new Date(d.closeDate).toLocaleDateString() : 'N/A'}
- **Company:** ${d.company?.name || 'N/A'}${d.company?.city || d.company?.country ? ` (${[d.company?.city, d.company?.country].filter(Boolean).join(', ')})` : ''}
`).join('\n')}
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
    description: 'Get a single deal by ID with full details.',
    inputSchema: z.object({
      id: z.string().describe('The deal ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) {
          params.fields = args.fields;
        } else {
          params.fields = 'id,name,value,stage,confidence,closeDate,startDate,endDate,companyId,company.id,company.name,company.country,company.city,contactIds,ownerIds,archived,createdAt,updatedAt,archivedAt';
        }

        const response = await client.get<{ data: Deal }>(`/api/deals/${args.id}`, { params });
        const deal = response.data.data;

        const formatValue = (d: Deal) => {
          if (d.value == null) return 'N/A';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d.value);
        };

        const stageName = await resolveStageName(deal.stage);

        const markdown = `## ${deal.name}

**ID:** ${deal.id}
**Value:** ${formatValue(deal)}
**Stage:** ${stageName}
**Confidence:** ${deal.confidence ? `${Math.round(parseFloat(deal.confidence) * 100)}%` : 'N/A'}
**Close Date:** ${deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'N/A'}

### Company
${deal.company ? `**${deal.company.name}** (${deal.company.id})${deal.company.city || deal.company.country ? `\n**Location:** ${[deal.company.city, deal.company.country].filter(Boolean).join(', ')}` : ''}` : 'No company associated'}

### Timestamps
- **Created:** ${new Date(deal.createdAt).toLocaleString()}
- **Updated:** ${new Date(deal.updatedAt).toLocaleString()}
${deal.archivedAt ? `- **Archived:** ${new Date(deal.archivedAt).toLocaleString()}` : ''}`;

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
    description: 'Create a new deal in Zero CRM.',
    inputSchema: z.object({
      name: z.string().describe('Deal name (required)'),
      value: z.number().optional().describe('Deal value'),
      stage: z.string().optional().describe('Pipeline stage ID. Use zero_list_pipeline_stages to look up valid stage IDs.'),
      confidence: z.string().optional().describe('Confidence as decimal (e.g., "0.60" for 60%)'),
      closeDate: z.string().optional().describe('Close date (ISO format)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs to associate with'),
    }),
    handler: async (args: { name: string; value?: number; stage?: string; confidence?: string; closeDate?: string; companyId?: string; contactIds?: string[] }) => {
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
**Created:** ${new Date(deal.createdAt).toLocaleString()}`,
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
    description: 'Update an existing deal in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The deal ID to update'),
      name: z.string().optional().describe('Deal name'),
      value: z.number().optional().describe('Deal value'),
      stage: z.string().optional().describe('Pipeline stage ID. Use zero_list_pipeline_stages to look up valid stage IDs.'),
      confidence: z.string().optional().describe('Confidence as decimal (e.g., "0.60" for 60%)'),
      closeDate: z.string().optional().describe('Close date (ISO format)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactIds: z.array(z.string()).optional().describe('Contact IDs to associate with'),
    }),
    handler: async (args: { id: string; name?: string; value?: number; stage?: string; confidence?: string; closeDate?: string; companyId?: string; contactIds?: string[] }) => {
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
**Updated:** ${new Date(deal.updatedAt).toLocaleString()}`,
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
      id: z.string().describe('The deal ID to delete'),
      archive: z.boolean().optional().default(true).describe('If true, soft delete (archive). If false, permanently delete.'),
    }),
    handler: async (args: { id: string; archive?: boolean }) => {
      try {
        const client = createApiClient();

        const params: Record<string, string> = {};
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
