import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Note, ApiListResponse } from '../types.js';

function formatContent(value: unknown): string {
  if (value == null) return 'N/A';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export const noteTools = {
  zero_list_notes: {
    description: 'List notes in Zero CRM with optional filtering and pagination. Filter examples: {"companyId": "uuid"}, {"contactId": "uuid"}, {"dealId": "uuid"}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"companyId": "uuid"})'),
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

        const response = await client.get<ApiListResponse<Note>>('/api/notes', { params });
        const notes = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + notes.length < total : notes.length === limit;

        if (notes.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No notes found matching your criteria.',
            }],
          };
        }

        const markdown = `## Notes (${notes.length}${total ? ` of ${total}` : ''})

${notes.map((n, i) => `### ${i + 1}. Note
- **ID:** ${n.id}
- **Content:** ${formatContent(n.content)}
- **Created:** ${new Date(n.createdAt).toLocaleDateString()}
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
            text: `Error listing notes: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_note: {
    description: 'Get a single note by ID with full details.',
    inputSchema: z.object({
      id: z.string().describe('The note ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/notes/${args.id}`, { params });
        const note: Note = response.data.data || response.data;

        const markdown = `## Note

**ID:** ${note.id}
**Content:** ${formatContent(note.content)}

### Timestamps
- **Created:** ${new Date(note.createdAt).toLocaleString()}
- **Updated:** ${new Date(note.updatedAt).toLocaleString()}
${note.archivedAt ? `- **Archived:** ${new Date(note.archivedAt).toLocaleString()}` : ''}`;

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
            text: `Error getting note: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_create_note: {
    description: 'Create a new note in Zero CRM.',
    inputSchema: z.object({
      content: z.union([z.string(), z.record(z.unknown())]).optional().describe('Note content (text or structured content)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactId: z.string().optional().describe('Contact ID to associate with'),
      dealId: z.string().optional().describe('Deal ID to associate with'),
    }),
    handler: async (args: { content?: string | Record<string, unknown>; companyId?: string; contactId?: string; dealId?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const response = await client.post<Note>('/api/notes', {
          ...args,
          workspaceId,
        });

        const note = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Note Created Successfully

**ID:** ${note.id}
**Created:** ${new Date(note.createdAt).toLocaleString()}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error creating note: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_update_note: {
    description: 'Update an existing note in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The note ID to update'),
      content: z.union([z.string(), z.record(z.unknown())]).optional().describe('Note content'),
      companyId: z.string().optional().describe('Company ID'),
      contactId: z.string().optional().describe('Contact ID'),
      dealId: z.string().optional().describe('Deal ID'),
    }),
    handler: async (args: { id: string; content?: string | Record<string, unknown>; companyId?: string; contactId?: string; dealId?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const { id, ...updateData } = args;

        const response = await client.patch<Note>(`/api/notes/${id}`, {
          ...updateData,
          workspaceId,
        });

        const note = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Note Updated Successfully

**ID:** ${note.id}
**Updated:** ${new Date(note.updatedAt).toLocaleString()}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error updating note: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_delete_note: {
    description: 'Delete or archive a note in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The note ID to delete'),
      archive: z.boolean().optional().default(true).describe('If true, soft delete (archive). If false, permanently delete.'),
    }),
    handler: async (args: { id: string; archive?: boolean }) => {
      try {
        const client = createApiClient();

        const params: Record<string, string> = {};
        if (args.archive !== false) {
          params.archive = 'true';
        }

        await client.delete(`/api/notes/${args.id}`, { params });

        const action = args.archive !== false ? 'archived' : 'permanently deleted';

        return {
          content: [{
            type: 'text' as const,
            text: `Note ${args.id} has been ${action}.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error deleting note: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
