import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Deal, ApiListResponse } from '../types.js';

export const dealTools = {
  zero_list_deals: {
    description: 'List deals in Zero CRM with optional filtering and pagination. Use the "where" parameter for filtering (e.g., {"stage": "negotiation"} or {"value": {"gte": 50000}}).',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions as JSON object'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"value": "desc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      includeRelations: z.boolean().optional().default(true).describe('Include company and contact details'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string; includeRelations?: boolean }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.includeRelations !== false && !fields) {
          fields = 'id,name,value,currency,stage,probability,expectedCloseDate,companyId,company.id,company.name,contactId,contact.firstName,contact.lastName,createdAt,updatedAt';
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
          if (!deal.value) return 'N/A';
          const currency = deal.currency || 'USD';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(deal.value);
        };

        const markdown = `## Deals (${deals.length}${total ? ` of ${total}` : ''})

${deals.map((d, i) => `### ${i + 1}. ${d.name}
- **ID:** ${d.id}
- **Value:** ${formatValue(d)}
- **Stage:** ${d.stage || 'N/A'}
- **Probability:** ${d.probability ? `${d.probability}%` : 'N/A'}
- **Expected Close:** ${d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : 'N/A'}
- **Company:** ${d.company?.name || 'N/A'}
- **Contact:** ${d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : 'N/A'}
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
          params.fields = 'id,name,value,currency,stage,probability,expectedCloseDate,description,companyId,company.id,company.name,contactId,contact.firstName,contact.lastName,contact.email,createdAt,updatedAt,archivedAt';
        }

        const response = await client.get<Deal>(`/api/deals/${args.id}`, { params });
        const deal = response.data;

        const formatValue = (d: Deal) => {
          if (!d.value) return 'N/A';
          const currency = d.currency || 'USD';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(d.value);
        };

        const markdown = `## ${deal.name}

**ID:** ${deal.id}
**Value:** ${formatValue(deal)}
**Stage:** ${deal.stage || 'N/A'}
**Probability:** ${deal.probability ? `${deal.probability}%` : 'N/A'}
**Expected Close:** ${deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'N/A'}

### Company
${deal.company ? `**${deal.company.name}** (${deal.company.id})` : 'No company associated'}

### Contact
${deal.contact ? `**${deal.contact.firstName} ${deal.contact.lastName}**${deal.contact.email ? ` (${deal.contact.email})` : ''}` : 'No contact associated'}

### Description
${deal.description || 'No description'}

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
      currency: z.string().optional().default('USD').describe('Currency code (default: USD)'),
      stage: z.string().optional().describe('Deal stage (e.g., "qualification", "proposal", "negotiation", "closed won", "closed lost")'),
      probability: z.number().optional().describe('Win probability percentage (0-100)'),
      expectedCloseDate: z.string().optional().describe('Expected close date (ISO format)'),
      description: z.string().optional().describe('Deal description'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactId: z.string().optional().describe('Contact ID to associate with'),
    }),
    handler: async (args: { name: string; value?: number; currency?: string; stage?: string; probability?: number; expectedCloseDate?: string; description?: string; companyId?: string; contactId?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const response = await client.post<Deal>('/api/deals', {
          ...args,
          workspaceId,
        });

        const deal = response.data;

        const formatValue = (d: Deal) => {
          if (!d.value) return 'N/A';
          const currency = d.currency || 'USD';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(d.value);
        };

        return {
          content: [{
            type: 'text' as const,
            text: `## Deal Created Successfully

**Name:** ${deal.name}
**ID:** ${deal.id}
**Value:** ${formatValue(deal)}
**Stage:** ${deal.stage || 'N/A'}
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
      currency: z.string().optional().describe('Currency code'),
      stage: z.string().optional().describe('Deal stage'),
      probability: z.number().optional().describe('Win probability percentage (0-100)'),
      expectedCloseDate: z.string().optional().describe('Expected close date (ISO format)'),
      description: z.string().optional().describe('Deal description'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactId: z.string().optional().describe('Contact ID to associate with'),
    }),
    handler: async (args: { id: string; name?: string; value?: number; currency?: string; stage?: string; probability?: number; expectedCloseDate?: string; description?: string; companyId?: string; contactId?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const { id, ...updateData } = args;

        const response = await client.patch<Deal>(`/api/deals/${id}`, {
          ...updateData,
          workspaceId,
        });

        const deal = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Deal Updated Successfully

**Name:** ${deal.name}
**ID:** ${deal.id}
**Stage:** ${deal.stage || 'N/A'}
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
