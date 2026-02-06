import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { CalendarEvent, ApiListResponse } from '../types.js';

export const calendarEventTools = {
  zero_list_calendar_events: {
    description: 'List calendar events (meetings) in Zero CRM. Each event has dealId, companyId, contactId fields for entity association. To find deals with recent meetings, filter by startTime and collect dealId values. Filter examples: {"dealId": "uuid"}, {"companyId": "uuid"}, {"startTime": {"$gte": "2026-02-03"}}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"companyId": "uuid"})'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"startTime": "asc"})'),
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

        const response = await client.get<ApiListResponse<CalendarEvent>>('/api/calendarEvents', { params });
        const events = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + events.length < total : events.length === limit;

        if (events.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No calendar events found matching your criteria.',
            }],
          };
        }

        const markdown = `## Calendar Events (${events.length}${total ? ` of ${total}` : ''})

${events.map((ev, i) => {
  const start = ev.startTime ? new Date(ev.startTime).toLocaleString() : 'N/A';
  const end = ev.endTime ? new Date(ev.endTime).toLocaleString() : '';
  return `### ${i + 1}. ${ev.title || 'Untitled'}
- **ID:** ${ev.id}
- **When:** ${start}${end ? ` to ${end}` : ''}
- **Location:** ${ev.location || 'N/A'}
${ev.dealId ? `- **Deal ID:** ${ev.dealId}` : ''}
${ev.companyId ? `- **Company ID:** ${ev.companyId}` : ''}
${ev.contactId ? `- **Contact ID:** ${ev.contactId}` : ''}
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
            text: `Error listing calendar events: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_calendar_event: {
    description: 'Get a single calendar event by ID with full details.',
    inputSchema: z.object({
      id: z.string().describe('The calendar event ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/calendarEvents/${args.id}`, { params });
        const event: CalendarEvent = response.data.data || response.data;

        const start = event.startTime ? new Date(event.startTime).toLocaleString() : 'N/A';
        const end = event.endTime ? new Date(event.endTime).toLocaleString() : 'N/A';

        const markdown = `## ${event.title || 'Untitled'}

**ID:** ${event.id}
**Start:** ${start}
**End:** ${end}
**Location:** ${event.location || 'N/A'}
**Description:** ${event.description || 'N/A'}

### Associations
${event.dealId ? `- **Deal ID:** ${event.dealId}` : '- **Deal:** None'}
${event.companyId ? `- **Company ID:** ${event.companyId}` : '- **Company:** None'}
${event.contactId ? `- **Contact ID:** ${event.contactId}` : '- **Contact:** None'}

### Timestamps
- **Created:** ${new Date(event.createdAt).toLocaleString()}
- **Updated:** ${new Date(event.updatedAt).toLocaleString()}`;

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
            text: `Error getting calendar event: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
