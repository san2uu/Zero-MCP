import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Comment, ApiListResponse } from '../types.js';

function formatContent(value: unknown): string {
  if (value == null) return 'N/A';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export const commentTools = {
  zero_list_comments: {
    description: 'List comments in Zero CRM with optional filtering and pagination. Filter examples: {"companyId": "uuid"}, {"contactId": "uuid"}, {"dealId": "uuid"}, {"taskId": "uuid"}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"dealId": "uuid"})'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
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

        const response = await client.get<ApiListResponse<Comment>>('/api/comments', { params });
        const comments = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + comments.length < total : comments.length === limit;

        if (comments.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No comments found matching your criteria.',
            }],
          };
        }

        const markdown = `## Comments (${comments.length}${total ? ` of ${total}` : ''})

${comments.map((c, i) => `### ${i + 1}. Comment
- **ID:** ${c.id}
- **Content:** ${formatContent(c.content)}
- **Author:** ${c.authorId || 'N/A'}
- **Created:** ${new Date(c.createdAt).toLocaleDateString()}
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
            text: `Error listing comments: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_comment: {
    description: 'Get a single comment by ID with full details.',
    inputSchema: z.object({
      id: z.string().describe('The comment ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/comments/${args.id}`, { params });
        const comment: Comment = response.data.data || response.data;

        const markdown = `## Comment

**ID:** ${comment.id}
**Content:** ${formatContent(comment.content)}
**Author:** ${comment.authorId || 'N/A'}

### Timestamps
- **Created:** ${new Date(comment.createdAt).toLocaleString()}
- **Updated:** ${new Date(comment.updatedAt).toLocaleString()}`;

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
            text: `Error getting comment: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_create_comment: {
    description: 'Create a new comment in Zero CRM.',
    inputSchema: z.object({
      content: z.union([z.string(), z.record(z.unknown())]).optional().describe('Comment content (text or structured content)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactId: z.string().optional().describe('Contact ID to associate with'),
      dealId: z.string().optional().describe('Deal ID to associate with'),
      taskId: z.string().optional().describe('Task ID to associate with'),
    }),
    handler: async (args: { content?: string | Record<string, unknown>; companyId?: string; contactId?: string; dealId?: string; taskId?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const response = await client.post<Comment>('/api/comments', {
          ...args,
          workspaceId,
        });

        const comment = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Comment Created Successfully

**ID:** ${comment.id}
**Created:** ${new Date(comment.createdAt).toLocaleString()}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error creating comment: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_update_comment: {
    description: 'Update an existing comment in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The comment ID to update'),
      content: z.union([z.string(), z.record(z.unknown())]).optional().describe('Comment content'),
    }),
    handler: async (args: { id: string; content?: string | Record<string, unknown> }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const { id, ...updateData } = args;

        const response = await client.patch<Comment>(`/api/comments/${id}`, {
          ...updateData,
          workspaceId,
        });

        const comment = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Comment Updated Successfully

**ID:** ${comment.id}
**Updated:** ${new Date(comment.updatedAt).toLocaleString()}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error updating comment: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_delete_comment: {
    description: 'Delete a comment in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The comment ID to delete'),
    }),
    handler: async (args: { id: string }) => {
      try {
        const client = createApiClient();

        await client.delete(`/api/comments/${args.id}`);

        return {
          content: [{
            type: 'text' as const,
            text: `Comment ${args.id} has been deleted.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error deleting comment: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
