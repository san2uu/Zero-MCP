import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, formatDate } from '../services/api.js';
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

${notes.map((n, i) => {
  const title = n.name ? `${n.emoji || ''} ${n.name}`.trim() : 'Note';
  return `### ${i + 1}. ${title}
- **ID:** ${n.id}
- **Content:** ${formatContent(n.content)}
- **Created:** ${formatDate(n.createdAt, 'date')}
`;
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
      id: z.string().uuid().describe('The note ID'),
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

        const title = note.name ? `${note.emoji || ''} ${note.name}`.trim() : 'Note';

        const markdown = `## ${title}

**ID:** ${note.id}
**Content:** ${formatContent(note.content)}

### Timestamps
- **Created:** ${formatDate(note.createdAt)}
- **Updated:** ${formatDate(note.updatedAt)}
${note.archived ? '- **Archived:** yes' : ''}`;

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
      name: z.string().optional().describe('Note title/name'),
      emoji: z.string().optional().describe('Emoji icon for the note'),
      content: z.union([z.string(), z.record(z.unknown())]).optional().describe('Note content (plain text or Tiptap JSON format)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactId: z.string().optional().describe('Contact ID to associate with'),
      dealId: z.string().optional().describe('Deal ID to associate with'),
      externalId: z.string().optional().describe('External system ID'),
      source: z.string().optional().describe('Source of the note record'),
    }),
    handler: async (args: { name?: string; emoji?: string; content?: string | Record<string, unknown>; companyId?: string; contactId?: string; dealId?: string; externalId?: string; source?: string }) => {
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

**ID:** ${note.id}${note.name ? `\n**Name:** ${note.name}` : ''}
**Created:** ${formatDate(note.createdAt)}`,
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
      id: z.string().uuid().describe('The note ID to update'),
      name: z.string().optional().describe('Note title/name'),
      emoji: z.string().optional().describe('Emoji icon for the note'),
      content: z.union([z.string(), z.record(z.unknown())]).optional().describe('Note content (plain text or Tiptap JSON format)'),
      companyId: z.string().optional().describe('Company ID'),
      contactId: z.string().optional().describe('Contact ID'),
      dealId: z.string().optional().describe('Deal ID'),
      externalId: z.string().optional().describe('External system ID'),
      source: z.string().optional().describe('Source of the note record'),
    }),
    handler: async (args: { id: string; name?: string; emoji?: string; content?: string | Record<string, unknown>; companyId?: string; contactId?: string; dealId?: string; externalId?: string; source?: string }) => {
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
      id: z.string().uuid().describe('The note ID to delete'),
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
