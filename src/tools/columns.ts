import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Column, ApiListResponse } from '../types.js';

export const columnTools = {
  zero_list_columns: {
    description: 'List custom property definitions (columns) for the workspace. Returns column IDs, names, types, and options. Use this to discover custom field IDs before filtering or updating records with custom properties. Filter by entity type (e.g., {"entity": "company"}) to see only columns for a specific entity.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"entity": "company"}, {"type": "select"})'),
      limit: z.number().int().min(1).max(1000).optional().default(100).describe('Max records to return (default: 100, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (min: 0)'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"name": "asc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params = buildQueryParams({
          workspaceId,
          where: args.where,
          limit: args.limit || 100,
          offset: args.offset || 0,
          orderBy: args.orderBy,
          fields: args.fields,
        });

        const response = await client.get<ApiListResponse<Column>>('/api/columns', { params });
        const columns = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 100;
        const offset = args.offset || 0;
        const hasMore = total ? offset + columns.length < total : columns.length === limit;

        if (columns.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No columns found matching your criteria.',
            }],
          };
        }

        const markdown = `## Columns (${columns.length}${total ? ` of ${total}` : ''})

${columns.map((col, i) => {
  let entry = `### ${i + 1}. ${col.name}
- **ID:** ${col.id}
- **Key:** ${col.key || 'N/A'}
- **Type:** ${col.type || 'N/A'}
- **Entity:** ${col.entity || 'N/A'}`;
  if (col.description) {
    entry += `\n- **Description:** ${col.description}`;
  }
  if (col.options && col.options.length > 0) {
    entry += `\n- **Options:** ${JSON.stringify(col.options)}`;
  }
  if (col.archived) {
    entry += `\n- **Archived:** yes`;
  }
  return entry + '\n';
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
            text: `Error listing columns: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
