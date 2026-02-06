import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Activity, ApiListResponse } from '../types.js';

export const activityTools = {
  zero_list_activities: {
    description: 'List activities (LinkedIn messages, custom activities, etc.) in Zero CRM. Each activity has dealId, companyId, contactId fields for entity association. To find deals with recent activity, filter by date and collect the dealId values. Filter examples: {"type": "call"}, {"dealId": "uuid"}, {"companyId": "uuid"}, {"occurredAt": {"$gte": "2026-02-03"}}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"type": "call"}, {"companyId": "uuid"})'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"occurredAt": "desc"})'),
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

${activities.map((a, i) => `### ${i + 1}. [${a.type || 'unknown'}] ${a.description || 'N/A'}
- **ID:** ${a.id}
- **Occurred:** ${a.occurredAt ? new Date(a.occurredAt).toLocaleString() : 'N/A'}
${a.dealId ? `- **Deal ID:** ${a.dealId}` : ''}
${a.companyId ? `- **Company ID:** ${a.companyId}` : ''}
${a.contactId ? `- **Contact ID:** ${a.contactId}` : ''}
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
**Description:** ${activity.description || 'N/A'}
**Occurred:** ${activity.occurredAt ? new Date(activity.occurredAt).toLocaleString() : 'N/A'}

### Associations
${activity.dealId ? `- **Deal ID:** ${activity.dealId}` : '- **Deal:** None'}
${activity.companyId ? `- **Company ID:** ${activity.companyId}` : '- **Company:** None'}
${activity.contactId ? `- **Contact ID:** ${activity.contactId}` : '- **Contact:** None'}

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
