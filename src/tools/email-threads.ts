import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { EmailThread, ApiListResponse } from '../types.js';

export const emailThreadTools = {
  zero_list_email_threads: {
    description: 'List email threads in Zero CRM with optional filtering and pagination. Filter examples: {"companyId": "uuid"}, {"contactId": "uuid"}, {"dealId": "uuid"}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"companyId": "uuid"})'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"lastMessageAt": "desc"})'),
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

        const response = await client.get<ApiListResponse<EmailThread>>('/api/emailThreads', { params });
        const threads = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + threads.length < total : threads.length === limit;

        if (threads.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No email threads found matching your criteria.',
            }],
          };
        }

        const markdown = `## Email Threads (${threads.length}${total ? ` of ${total}` : ''})

${threads.map((t, i) => `### ${i + 1}. ${t.subject || 'No subject'}
- **ID:** ${t.id}
- **Snippet:** ${t.snippet || 'N/A'}
- **From:** ${t.from || 'N/A'}
- **Last Message:** ${t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString() : 'N/A'}
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
            text: `Error listing email threads: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_email_thread: {
    description: 'Get a single email thread by ID with full details.',
    inputSchema: z.object({
      id: z.string().describe('The email thread ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/emailThreads/${args.id}`, { params });
        const thread: EmailThread = response.data.data || response.data;

        const markdown = `## ${thread.subject || 'No subject'}

**ID:** ${thread.id}
**From:** ${thread.from || 'N/A'}
**To:** ${thread.to?.join(', ') || 'N/A'}
**Snippet:** ${thread.snippet || 'N/A'}
**Last Message:** ${thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString() : 'N/A'}

### Timestamps
- **Created:** ${new Date(thread.createdAt).toLocaleString()}
- **Updated:** ${new Date(thread.updatedAt).toLocaleString()}`;

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
            text: `Error getting email thread: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
