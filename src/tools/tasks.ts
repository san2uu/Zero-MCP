import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, formatDate } from '../services/api.js';
import { Task, ApiListResponse } from '../types.js';

function formatContent(value: unknown): string {
  if (value == null) return 'N/A';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export const taskTools = {
  zero_list_tasks: {
    description: 'List tasks in Zero CRM with optional filtering and pagination. Filter examples: {"done": false}, {"dealId": "uuid"}, {"companyId": "uuid"}, {"contactId": "uuid"}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"done": false}, {"companyId": "uuid"})'),
      limit: z.number().int().min(1).max(1000).optional().default(20).describe('Max records to return (default: 20, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (min: 0)'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"deadline": "asc"})'),
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

        const response = await client.get<ApiListResponse<Task>>('/api/tasks', { params });
        const tasks = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + tasks.length < total : tasks.length === limit;

        if (tasks.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No tasks found matching your criteria.',
            }],
          };
        }

        const markdown = `## Tasks (${tasks.length}${total ? ` of ${total}` : ''})

${tasks.map((t, i) => {
  const check = t.done ? '[x]' : '[ ]';
  const deadline = t.deadline ? ` (due ${formatDate(t.deadline, 'date')})` : '';
  return `### ${i + 1}. ${check} ${t.name}
- **ID:** ${t.id}
- **Description:** ${formatContent(t.description)}${deadline ? `\n- **Deadline:** ${formatDate(t.deadline, 'date')}` : ''}
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
            text: `Error listing tasks: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_task: {
    description: 'Get a single task by ID with full details.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The task ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/tasks/${args.id}`, { params });
        const task: Task = response.data.data || response.data;

        const check = task.done ? '[x]' : '[ ]';
        const markdown = `## ${check} ${task.name}

**ID:** ${task.id}
**Status:** ${task.done ? 'Complete' : 'Incomplete'}
**Description:** ${formatContent(task.description)}
${task.deadline ? `**Deadline:** ${formatDate(task.deadline, 'date')}` : ''}

### Timestamps
- **Created:** ${formatDate(task.createdAt)}
- **Updated:** ${formatDate(task.updatedAt)}
${task.archivedAt ? `- **Archived:** ${formatDate(task.archivedAt)}` : ''}`;

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
            text: `Error getting task: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_create_task: {
    description: 'Create a new task in Zero CRM.',
    inputSchema: z.object({
      name: z.string().describe('Task name (required)'),
      description: z.union([z.string(), z.record(z.unknown())]).optional().describe('Task description (text or structured content)'),
      done: z.boolean().optional().describe('Whether the task is complete'),
      deadline: z.string().optional().describe('Deadline (ISO format)'),
      companyId: z.string().optional().describe('Company ID to associate with'),
      contactId: z.string().optional().describe('Contact ID to associate with'),
      dealId: z.string().optional().describe('Deal ID to associate with'),
      assigneeIds: z.array(z.string()).optional().describe('User IDs to assign'),
    }),
    handler: async (args: { name: string; description?: string | Record<string, unknown>; done?: boolean; deadline?: string; companyId?: string; contactId?: string; dealId?: string; assigneeIds?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const response = await client.post<Task>('/api/tasks', {
          ...args,
          workspaceId,
        });

        const task = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Task Created Successfully

**Name:** ${task.name}
**ID:** ${task.id}
**Created:** ${formatDate(task.createdAt)}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error creating task: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_update_task: {
    description: 'Update an existing task in Zero CRM.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The task ID to update'),
      name: z.string().optional().describe('Task name'),
      description: z.union([z.string(), z.record(z.unknown())]).optional().describe('Task description'),
      done: z.boolean().optional().describe('Whether the task is complete'),
      deadline: z.string().optional().describe('Deadline (ISO format)'),
      companyId: z.string().optional().describe('Company ID'),
      contactId: z.string().optional().describe('Contact ID'),
      dealId: z.string().optional().describe('Deal ID'),
      assigneeIds: z.array(z.string()).optional().describe('User IDs to assign'),
    }),
    handler: async (args: { id: string; name?: string; description?: string | Record<string, unknown>; done?: boolean; deadline?: string; companyId?: string; contactId?: string; dealId?: string; assigneeIds?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const { id, ...updateData } = args;

        const response = await client.patch<Task>(`/api/tasks/${id}`, {
          ...updateData,
          workspaceId,
        });

        const task = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Task Updated Successfully

**Name:** ${task.name}
**ID:** ${task.id}
**Updated:** ${formatDate(task.updatedAt)}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error updating task: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_delete_task: {
    description: 'Delete or archive a task in Zero CRM.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The task ID to delete'),
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

        await client.delete(`/api/tasks/${args.id}`, { params });

        const action = args.archive !== false ? 'archived' : 'permanently deleted';

        return {
          content: [{
            type: 'text' as const,
            text: `Task ${args.id} has been ${action}.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error deleting task: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
