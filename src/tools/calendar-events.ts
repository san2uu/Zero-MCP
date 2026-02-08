import { z } from 'zod';
import { AxiosInstance } from 'axios';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, formatDate } from '../services/api.js';
import { CalendarEvent, ApiListResponse } from '../types.js';
import { buildIncludeFields, formatIncludedRelations } from '../services/relations.js';

/**
 * Deduplicates calendar events by name + startTime (truncated to minute).
 * When merging, unions all array fields (contactIds, companyIds, dealIds, userIds, attendeeEmails)
 * and keeps the first event's scalar fields (id, name, description, location, endTime).
 * Returns { events, duplicatesRemoved }.
 */
export function deduplicateCalendarEvents(events: CalendarEvent[]): { events: CalendarEvent[]; duplicatesRemoved: number } {
  const seen = new Map<string, CalendarEvent>();
  let duplicatesRemoved = 0;

  for (const event of events) {
    const key = `${(event.name || '').trim().toLowerCase()}|${(event.startTime || '').slice(0, 16)}`;
    const existing = seen.get(key);
    if (existing) {
      // Union array fields
      existing.contactIds = [...new Set([...(existing.contactIds || []), ...(event.contactIds || [])])];
      existing.companyIds = [...new Set([...(existing.companyIds || []), ...(event.companyIds || [])])];
      existing.dealIds = [...new Set([...(existing.dealIds || []), ...(event.dealIds || [])])];
      existing.userIds = [...new Set([...(existing.userIds || []), ...(event.userIds || [])])];
      existing.attendeeEmails = [...new Set([...(existing.attendeeEmails || []), ...(event.attendeeEmails || [])])];
      duplicatesRemoved++;
    } else {
      // Clone to avoid mutating the original
      seen.set(key, { ...event });
    }
  }

  return { events: [...seen.values()], duplicatesRemoved };
}

/**
 * Manually resolves included relations on calendar events.
 * Used as a workaround when the API's JOIN-based include fails with 500
 * when combined with where/orderBy filters.
 */
async function resolveCalendarEventIncludes(
  client: AxiosInstance,
  workspaceId: string,
  events: CalendarEvent[],
  include: string[],
): Promise<void> {
  const resolvePromises: Promise<void>[] = [];

  if (include.includes('contacts')) {
    const allContactIds = [...new Set(events.flatMap(e => e.contactIds || []))];
    if (allContactIds.length > 0) {
      resolvePromises.push(
        (async () => {
          try {
            const params = buildQueryParams({
              workspaceId,
              where: { id: { $in: allContactIds } },
              limit: allContactIds.length,
              fields: 'id,firstName,lastName,email,title',
            });
            const response = await client.get('/api/contacts', { params });
            const contacts = response.data.data || [];
            const contactMap = new Map(contacts.map((c: Record<string, string>) => [c.id, c]));
            for (const event of events) {
              (event as unknown as Record<string, unknown>).contacts = (event.contactIds || [])
                .map((id: string) => contactMap.get(id))
                .filter(Boolean);
            }
          } catch {
            // If contact resolution fails, events still display with contactIds
          }
        })(),
      );
    }
  }

  if (include.includes('companies')) {
    const allCompanyIds = [...new Set(events.flatMap(e => e.companyIds || []))];
    if (allCompanyIds.length > 0) {
      resolvePromises.push(
        (async () => {
          try {
            const params = buildQueryParams({
              workspaceId,
              where: { id: { $in: allCompanyIds } },
              limit: allCompanyIds.length,
              fields: 'id,name,domain',
            });
            const response = await client.get('/api/companies', { params });
            const companies = response.data.data || [];
            const companyMap = new Map(companies.map((c: Record<string, string>) => [c.id, c]));
            for (const event of events) {
              (event as unknown as Record<string, unknown>).companies = (event.companyIds || [])
                .map((id: string) => companyMap.get(id))
                .filter(Boolean);
            }
          } catch {
            // If company resolution fails, events still display with companyIds
          }
        })(),
      );
    }
  }

  // 'tasks' cannot be resolved via fallback — no way to query tasks by calendar event ID
  await Promise.all(resolvePromises);
}

/**
 * Builds a unique contacts summary section for multi-event results.
 * Separates named contacts from email-only contacts.
 */
function buildUniqueContactsSummary(events: CalendarEvent[]): string {
  const contactMap = new Map<string, Record<string, unknown>>();
  for (const event of events) {
    const contacts = (event as unknown as Record<string, unknown>).contacts as Record<string, unknown>[] | undefined;
    if (!contacts) continue;
    for (const c of contacts) {
      if (c.id && !contactMap.has(c.id as string)) {
        contactMap.set(c.id as string, c);
      }
    }
  }
  if (contactMap.size === 0) return '';

  const named: Record<string, unknown>[] = [];
  const emailOnly: Record<string, unknown>[] = [];
  for (const c of contactMap.values()) {
    if (c.firstName || c.lastName) {
      named.push(c);
    } else {
      emailOnly.push(c);
    }
  }

  let summary = `\n### Unique Contacts Met (${contactMap.size})\n`;
  for (const c of named) {
    summary += `- ${c.firstName || ''} ${c.lastName || ''} — ${c.email || 'N/A'}${c.title ? ` (${c.title})` : ''}\n`;
  }
  for (const c of emailOnly) {
    summary += `- ${c.email || 'N/A'} (unresolved attendee)\n`;
  }
  return summary;
}

export const calendarEventTools = {
  zero_list_calendar_events: {
    description: 'List calendar events (meetings) in Zero CRM. Each event has dealIds, companyIds, contactIds (plural arrays) and userIds (workspace members) for entity association. Filter by array fields using $contains: {"contactIds": {"$contains": "uuid"}}. Date range filter: {"startTime": {"$between": ["2026-02-02", "2026-02-08"]}}. Single-bound filter: {"startTime": {"$gte": "2026-02-03"}}. By default, events with no start time are excluded (set excludeNullDates: false to include them). Use fetchAll: true with a date range to get all events (auto-paginates, max 500). Workflow: "Who did I meet this week?" → where + fetchAll: true + include: ["contacts"] returns all events with a unique contacts summary.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions. Array fields use $contains: {"contactIds": {"$contains": "uuid"}}. Date ranges use $between: {"startTime": {"$between": ["2026-02-02", "2026-02-08"]}}'),
      limit: z.number().int().min(1).max(1000).optional().default(20).describe('Max records to return (default: 20, max: 1000). Ignored when fetchAll is true.'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (min: 0). Ignored when fetchAll is true.'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"startTime": "asc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: contacts, companies, tasks. Use include: ["contacts"] to get full contact details instead of just IDs. When listing 2+ events, a unique contacts summary is appended.'),
      excludeNullDates: z.boolean().optional().default(true).describe('Exclude events with no start time (default: true). Set false to include all.'),
      deduplicate: z.boolean().optional().default(true).describe('Merge duplicate events (same name + start time to the minute). Unions contactIds, companyIds, dealIds, userIds, attendeeEmails. Default: true.'),
      fetchAll: z.boolean().optional().describe('Auto-paginate to fetch all matching events (max 500). Use with a date range filter. When true, limit/offset are ignored.'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string; include?: string[]; excludeNullDates?: boolean; deduplicate?: boolean; fetchAll?: boolean }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        // Exclude events with null startTime by default
        let where = args.where;
        if (args.excludeNullDates !== false && (!where || !where.startTime)) {
          where = { ...where, startTime: { $gte: '2000-01-01' } };
        }

        // API bug: relation JOINs (include) combined with where/orderBy cause 500.
        // Fall back to manual resolution when both are present.
        const useIncludeFallback = args.include && args.include.length > 0 && (where || args.orderBy);

        let fields = args.fields;
        if (args.include && args.include.length > 0 && !useIncludeFallback) {
          if (!fields) {
            fields = 'id,name,startTime,endTime,location,userIds,dealIds,companyIds,contactIds,createdAt,updatedAt';
          }
          fields = buildIncludeFields('calendarEvent', args.include, fields);
        }

        const dedupEnabled = args.deduplicate !== false;
        const FETCH_ALL_PAGE_SIZE = 200;
        const FETCH_ALL_CAP = 500;

        let allEvents: CalendarEvent[];

        if (args.fetchAll) {
          // Auto-paginate through all results
          allEvents = [];
          let currentOffset = 0;
          let hasMore = true;

          while (hasMore && allEvents.length < FETCH_ALL_CAP) {
            const params = buildQueryParams({
              workspaceId,
              where,
              limit: FETCH_ALL_PAGE_SIZE,
              offset: currentOffset,
              orderBy: args.orderBy,
              fields,
            });

            const response = await client.get<ApiListResponse<CalendarEvent>>('/api/calendarEvents', { params });
            const pageEvents = response.data.data || [];
            const total = response.data.total;
            allEvents.push(...pageEvents);
            currentOffset += pageEvents.length;
            // Use total if available, otherwise check if we got a full page
            hasMore = total ? currentOffset < total : pageEvents.length === FETCH_ALL_PAGE_SIZE;
          }

          // Trim to safety cap
          const hitCap = allEvents.length > FETCH_ALL_CAP;
          if (hitCap) {
            allEvents = allEvents.slice(0, FETCH_ALL_CAP);
          }

          // Manually resolve included relations in fallback mode
          if (useIncludeFallback && allEvents.length > 0) {
            await resolveCalendarEventIncludes(client, workspaceId, allEvents, args.include!);
          }

          // Deduplicate
          let displayEvents = allEvents;
          let duplicatesRemoved = 0;
          if (dedupEnabled && allEvents.length > 0) {
            const dedupResult = deduplicateCalendarEvents(allEvents);
            displayEvents = dedupResult.events;
            duplicatesRemoved = dedupResult.duplicatesRemoved;
          }

          if (displayEvents.length === 0) {
            return {
              content: [{
                type: 'text' as const,
                text: 'No calendar events found matching your criteria.',
              }],
            };
          }

          const dedupNote = duplicatesRemoved > 0 ? ` (${duplicatesRemoved} duplicates merged)` : '';
          let markdown = `## Calendar Events (${displayEvents.length}${dedupNote})

${displayEvents.map((ev, i) => {
  const start = formatDate(ev.startTime);
  const end = ev.endTime ? formatDate(ev.endTime) : '';
  return `### ${i + 1}. ${ev.name || 'Untitled'}
- **ID:** ${ev.id}
- **When:** ${start}${end ? ` to ${end}` : ''}
- **Location:** ${ev.location || 'N/A'}
${ev.userIds?.length ? `- **User IDs:** ${ev.userIds.join(', ')}` : ''}
${ev.dealIds?.length ? `- **Deal IDs:** ${ev.dealIds.join(', ')}` : ''}
${ev.companyIds?.length ? `- **Company IDs:** ${ev.companyIds.join(', ')}` : ''}
${ev.contactIds?.length ? `- **Contact IDs:** ${ev.contactIds.join(', ')}` : ''}
${args.include && args.include.length > 0 ? formatIncludedRelations('calendarEvent', ev as unknown as Record<string, unknown>, args.include) : ''}`;
}).join('\n')}
${hitCap ? `\n*Results truncated at ${FETCH_ALL_CAP} events. Add stricter filters to narrow results.*` : ''}`;

          // Unique contacts summary for multi-event results (use pre-dedup events for complete data)
          if (args.include?.includes('contacts') && displayEvents.length >= 2) {
            markdown += buildUniqueContactsSummary(allEvents);
          }

          return {
            content: [{
              type: 'text' as const,
              text: markdown,
            }],
          };
        }

        // Standard (non-fetchAll) path
        const limit = args.limit || 20;
        const offset = args.offset || 0;

        // When dedup is enabled, over-fetch to compensate for duplicates being merged
        const fetchLimit = dedupEnabled ? limit * 2 : limit;

        const params = buildQueryParams({
          workspaceId,
          where,
          limit: fetchLimit,
          offset,
          orderBy: args.orderBy,
          fields,
        });

        const response = await client.get<ApiListResponse<CalendarEvent>>('/api/calendarEvents', { params });
        const events = response.data.data || [];
        const total = response.data.total;

        // Manually resolve included relations in fallback mode
        if (useIncludeFallback && events.length > 0) {
          await resolveCalendarEventIncludes(client, workspaceId, events, args.include!);
        }

        // Deduplicate events if enabled (default: true)
        let displayEvents = events;
        let duplicatesRemoved = 0;
        if (dedupEnabled && events.length > 0) {
          const dedupResult = deduplicateCalendarEvents(events);
          displayEvents = dedupResult.events;
          duplicatesRemoved = dedupResult.duplicatesRemoved;
        }

        // Trim to user's requested limit after dedup
        const trimmed = displayEvents.length > limit;
        if (trimmed) {
          displayEvents = displayEvents.slice(0, limit);
        }

        const hasMore = dedupEnabled
          ? (total ? offset + events.length < total : events.length === fetchLimit) || trimmed
          : (total ? offset + events.length < total : events.length === limit);

        if (displayEvents.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No calendar events found matching your criteria.',
            }],
          };
        }

        const dedupNote = duplicatesRemoved > 0 ? ` (${duplicatesRemoved} duplicates merged)` : '';
        let markdown = `## Calendar Events (${displayEvents.length}${dedupNote})

${displayEvents.map((ev, i) => {
  const start = formatDate(ev.startTime);
  const end = ev.endTime ? formatDate(ev.endTime) : '';
  return `### ${i + 1}. ${ev.name || 'Untitled'}
- **ID:** ${ev.id}
- **When:** ${start}${end ? ` to ${end}` : ''}
- **Location:** ${ev.location || 'N/A'}
${ev.userIds?.length ? `- **User IDs:** ${ev.userIds.join(', ')}` : ''}
${ev.dealIds?.length ? `- **Deal IDs:** ${ev.dealIds.join(', ')}` : ''}
${ev.companyIds?.length ? `- **Company IDs:** ${ev.companyIds.join(', ')}` : ''}
${ev.contactIds?.length ? `- **Contact IDs:** ${ev.contactIds.join(', ')}` : ''}
${args.include && args.include.length > 0 ? formatIncludedRelations('calendarEvent', ev as unknown as Record<string, unknown>, args.include) : ''}`;
}).join('\n')}
${hasMore ? `\n*More results available. Use offset=${offset + limit} to see next page.*` : ''}`;

        // Unique contacts summary for multi-event results (use pre-dedup events for complete data)
        if (args.include?.includes('contacts') && displayEvents.length >= 2) {
          markdown += buildUniqueContactsSummary(events);
        }

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
      id: z.string().uuid().describe('The calendar event ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: contacts, companies, tasks'),
    }),
    handler: async (args: { id: string; fields?: string; include?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.include && args.include.length > 0) {
          if (!fields) {
            fields = 'id,name,description,startTime,endTime,location,userIds,attendeeEmails,dealIds,companyIds,contactIds,createdAt,updatedAt';
          }
          fields = buildIncludeFields('calendarEvent', args.include, fields);
        }

        const params: Record<string, string> = { workspaceId };
        if (fields) params.fields = fields;

        const response = await client.get(`/api/calendarEvents/${args.id}`, { params });
        const event: CalendarEvent = response.data.data || response.data;

        const start = formatDate(event.startTime);
        const end = formatDate(event.endTime);

        let markdown = `## ${event.name || 'Untitled'}

**ID:** ${event.id}
**Start:** ${start}
**End:** ${end}
**Location:** ${event.location || 'N/A'}
**Description:** ${event.description || 'N/A'}

### Participants
${event.userIds?.length ? `- **User IDs:** ${event.userIds.join(', ')}` : '- **Users:** None'}
${event.attendeeEmails?.length ? `- **Attendee Emails:** ${event.attendeeEmails.join(', ')}` : ''}

### Associations
${event.dealIds?.length ? `- **Deal IDs:** ${event.dealIds.join(', ')}` : '- **Deals:** None'}
${event.companyIds?.length ? `- **Company IDs:** ${event.companyIds.join(', ')}` : '- **Companies:** None'}
${event.contactIds?.length ? `- **Contact IDs:** ${event.contactIds.join(', ')}` : '- **Contacts:** None'}

### Timestamps
- **Created:** ${formatDate(event.createdAt)}
- **Updated:** ${formatDate(event.updatedAt)}`;

        if (args.include && args.include.length > 0) {
          markdown += formatIncludedRelations('calendarEvent', event as unknown as Record<string, unknown>, args.include);
        }

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
