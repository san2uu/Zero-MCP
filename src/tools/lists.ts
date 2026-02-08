import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { List, ApiListResponse } from '../types.js';

export const listTools = {
  zero_list_lists: {
    description: 'List saved lists in Zero CRM with optional filtering and pagination. Filter examples: {"entity": "company"}, {"entity": "deal"}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"entity": "company"})'),
      limit: z.number().int().min(1).max(1000).optional().default(20).describe('Max records to return (default: 20, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (min: 0)'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"createdAt": "desc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params = buildQueryParams({
          workspaceId,
          where: args.where,
          limit: args.limit || 20,
          offset: args.offset || 0,
          orderBy: args.orderBy,
          fields: args.fields,
        });

        const response = await client.get<ApiListResponse<List>>('/api/lists', { params });
        const lists = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + lists.length < total : lists.length === limit;

        if (lists.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No lists found matching your criteria.',
            }],
          };
        }

        const markdown = `## Lists (${lists.length}${total ? ` of ${total}` : ''})

${lists.map((l, i) => `### ${i + 1}. ${l.name}
- **ID:** ${l.id}
- **Entity:** ${l.entity || 'N/A'}
- **Color:** ${l.color || 'N/A'}
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
            text: `Error listing lists: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_list: {
    description: 'Get a single list by ID with full details.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The list ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/lists/${args.id}`, { params });
        const list: List = response.data.data || response.data;

        const markdown = `## ${list.name}

**ID:** ${list.id}
**Entity:** ${list.entity || 'N/A'}
**Color:** ${list.color || 'N/A'}

### Timestamps
- **Created:** ${new Date(list.createdAt).toLocaleString()}
- **Updated:** ${new Date(list.updatedAt).toLocaleString()}`;

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
            text: `Error getting list: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
