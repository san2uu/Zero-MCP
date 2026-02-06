import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Activity, ApiListResponse } from '../types.js';

export const activityTools = {
  zero_list_activities: {
    description: 'List activities (LinkedIn messages, custom activities, etc.) in Zero CRM. Each activity has companyIds, contactIds fields for entity association. Filter examples: {"type": "call"}, {"time": {"$gte": "2026-02-03"}}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"type": "call"}, {"time": {"$gte": "2026-02-03"}})'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"time": "desc"})'),
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

        const response = await client.get<ApiListResponse<Activity>>('/api/activities', { params });
        const activities = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + activities.length < total : activities.length === limit;

        if (activities.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No activities found matching your criteria.',
            }],
          };
        }

        const markdown = `## Activities (${activities.length}${total ? ` of ${total}` : ''})

${activities.map((a, i) => `### ${i + 1}. [${a.type || 'unknown'}] ${a.name || 'N/A'}
- **ID:** ${a.id}
- **Time:** ${a.time ? new Date(a.time).toLocaleString() : 'N/A'}
${a.companyIds?.length ? `- **Company IDs:** ${a.companyIds.join(', ')}` : ''}
${a.contactIds?.length ? `- **Contact IDs:** ${a.contactIds.join(', ')}` : ''}
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
            text: `Error listing activities: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_activity: {
    description: 'Get a single activity by ID with full details.',
    inputSchema: z.object({
      id: z.string().describe('The activity ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/activities/${args.id}`, { params });
        const activity: Activity = response.data.data || response.data;

        const markdown = `## Activity: ${activity.type || 'Unknown'}

**ID:** ${activity.id}
**Type:** ${activity.type || 'N/A'}
**Name:** ${activity.name || 'N/A'}
**Time:** ${activity.time ? new Date(activity.time).toLocaleString() : 'N/A'}

### Associations
${activity.companyIds?.length ? `- **Company IDs:** ${activity.companyIds.join(', ')}` : '- **Company:** None'}
${activity.contactIds?.length ? `- **Contact IDs:** ${activity.contactIds.join(', ')}` : '- **Contact:** None'}

### Timestamps
- **Created:** ${new Date(activity.createdAt).toLocaleString()}
- **Updated:** ${new Date(activity.updatedAt).toLocaleString()}`;

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
            text: `Error getting activity: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
