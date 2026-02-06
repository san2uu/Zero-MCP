import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, resolveStageName, fetchCompaniesByIds } from '../services/api.js';
import { Deal, Activity, EmailThread, CalendarEvent, Issue, ApiListResponse } from '../types.js';

interface ActivitySummary {
  activities: number;
  emails: number;
  calendarEvents: number;
  issues: number;
  lastActivity?: string;
}

const SOURCES = ['activities', 'emailThreads', 'calendarEvents', 'issues'] as const;
type Source = typeof SOURCES[number];

const SOURCE_DATE_FIELDS: Record<Source, string> = {
  activities: 'time',
  emailThreads: 'lastEmailTime',
  calendarEvents: 'startTime',
  issues: 'createdAt',
};

export const activeDealTools = {
  zero_find_active_deals: {
    description: 'Find deals that have had recent activity — emails, meetings, LinkedIn messages, custom activities, or Slack messages (issues). Queries all activity sources in parallel, resolves deals through their company associations, and returns an enriched deal list with activity summary. This is the recommended tool for questions like "which deals had activity this week?" or "deals with recent engagement".',
    inputSchema: z.object({
      since: z.string().describe('ISO date string — only include activity from this date onward (e.g., "2026-02-03")'),
      until: z.string().optional().describe('ISO date string — only include activity before this date (exclusive). Defaults to now.'),
      sources: z.array(z.enum(['activities', 'emailThreads', 'calendarEvents', 'issues'])).optional().describe('Which activity sources to query. Defaults to all: activities, emailThreads, calendarEvents, issues.'),
      dealWhere: z.record(z.unknown()).optional().describe('Additional filter on the deals themselves (e.g., {"stage": "<stage_id>"} to only show active-stage deals)'),
      limit: z.number().optional().default(200).describe('Max activity records to fetch per source (default: 200)'),
    }),
    handler: async (args: {
      since: string;
      until?: string;
      sources?: Source[];
      dealWhere?: Record<string, unknown>;
      limit?: number;
    }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();
        const activeSources = args.sources || [...SOURCES];
        const perSourceLimit = args.limit || 200;

        // Build date filter for each source and fetch in parallel
        const sourcePromises = activeSources.map(async (source) => {
          const dateField = SOURCE_DATE_FIELDS[source];
          const where: Record<string, unknown> = {
            [dateField]: { $gte: args.since },
          };
          if (args.until) {
            where[dateField] = { ...where[dateField] as Record<string, unknown>, $lt: args.until };
          }

          const fieldsList = ['id', 'companyIds', dateField].join(',');

          const params = buildQueryParams({
            workspaceId,
            where,
            limit: perSourceLimit,
            offset: 0,
            fields: fieldsList,
          });

          try {
            const response = await client.get<ApiListResponse<{ id: string; companyIds?: string[]; [key: string]: unknown }>>(`/api/${source}`, { params });
            return { source, data: response.data.data || [], total: response.data.total };
          } catch {
            // If a source fails (e.g., issues endpoint doesn't exist yet), skip it
            return { source, data: [], total: 0 };
          }
        });

        const sourceResults = await Promise.all(sourcePromises);

        // Collect companyIds and build per-company activity summary
        const companySummaries = new Map<string, ActivitySummary>();

        const summaryKey = (source: Source): keyof ActivitySummary => {
          switch (source) {
            case 'activities': return 'activities';
            case 'emailThreads': return 'emails';
            case 'calendarEvents': return 'calendarEvents';
            case 'issues': return 'issues';
          }
        };

        for (const result of sourceResults) {
          const dateField = SOURCE_DATE_FIELDS[result.source as Source];
          const key = summaryKey(result.source as Source);
          for (const item of result.data) {
            const itemCompanyIds: string[] = Array.isArray(item.companyIds)
              ? item.companyIds as string[]
              : [];
            if (itemCompanyIds.length === 0) continue;
            const itemDate = item[dateField] as string | undefined;
            for (const companyId of itemCompanyIds) {
              const existing = companySummaries.get(companyId) || {
                activities: 0,
                emails: 0,
                calendarEvents: 0,
                issues: 0,
              };
              (existing[key] as number)++;
              if (itemDate && (!existing.lastActivity || itemDate > existing.lastActivity)) {
                existing.lastActivity = itemDate;
              }
              companySummaries.set(companyId, existing);
            }
          }
        }

        if (companySummaries.size === 0) {
          const checkedSources = sourceResults.map((r) => `${r.source}: ${r.data.length} records`).join(', ');
          return {
            content: [{
              type: 'text' as const,
              text: `No deals found with activity since ${args.since}.\n\nSources checked: ${checkedSources}`,
            }],
          };
        }

        // Fetch deals linked to active companies
        const activeCompanyIds = [...companySummaries.keys()];
        const dealWhere: Record<string, unknown> = {
          companyId: { $in: activeCompanyIds },
          ...(args.dealWhere || {}),
        };

        const dealParams = buildQueryParams({
          workspaceId,
          where: dealWhere,
          limit: activeCompanyIds.length * 5, // companies may have multiple deals
          offset: 0,
          fields: 'id,name,value,stage,confidence,closeDate,companyId,createdAt,updatedAt',
        });

        const dealResponse = await client.get<ApiListResponse<Deal>>('/api/deals', { params: dealParams });
        const deals = dealResponse.data.data || [];

        if (deals.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `Found activity for ${activeCompanyIds.length} company/companies since ${args.since}, but no matching deals found.`,
            }],
          };
        }

        // Enrich with stage names and company info
        const companyIds = deals.map((d) => d.companyId).filter(Boolean) as string[];
        const [stageNames, companyMap] = await Promise.all([
          Promise.all(deals.map((d) => resolveStageName(d.stage))),
          fetchCompaniesByIds(companyIds),
        ]);

        // Sort deals by last activity date (most recent first)
        const sortedDeals = deals
          .map((d, i) => ({ deal: d, stageName: stageNames[i], summary: d.companyId ? companySummaries.get(d.companyId) : undefined }))
          .filter((item): item is typeof item & { summary: ActivitySummary } => item.summary != null)
          .sort((a, b) => {
            const dateA = a.summary.lastActivity || '';
            const dateB = b.summary.lastActivity || '';
            return dateB.localeCompare(dateA);
          });

        const formatValue = (deal: Deal) => {
          if (deal.value == null) return 'N/A';
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(deal.value);
        };

        const formatCompany = (deal: Deal) => {
          const enriched = deal.companyId ? companyMap.get(deal.companyId) : undefined;
          if (!enriched?.name) return 'N/A';
          const location = [enriched.city, enriched.country].filter(Boolean).join(', ');
          return location ? `${enriched.name} (${location})` : enriched.name;
        };

        const formatSummary = (summary: ActivitySummary) => {
          const parts: string[] = [];
          if (summary.activities > 0) parts.push(`${summary.activities} activit${summary.activities === 1 ? 'y' : 'ies'}`);
          if (summary.emails > 0) parts.push(`${summary.emails} email${summary.emails === 1 ? '' : 's'}`);
          if (summary.calendarEvents > 0) parts.push(`${summary.calendarEvents} meeting${summary.calendarEvents === 1 ? '' : 's'}`);
          if (summary.issues > 0) parts.push(`${summary.issues} Slack message${summary.issues === 1 ? '' : 's'}`);
          return parts.join(', ');
        };

        // Source stats
        const sourceStats = sourceResults.map((r) => {
          const label = r.source === 'emailThreads' ? 'emails' : r.source === 'calendarEvents' ? 'meetings' : r.source;
          const truncated = r.total && r.total > r.data.length ? ` (truncated, ${r.total} total)` : '';
          return `${label}: ${r.data.length}${truncated}`;
        }).join(', ');

        const markdown = `## Active Deals Since ${new Date(args.since).toLocaleDateString()} (${sortedDeals.length} deals)

**Sources queried:** ${sourceStats}

${sortedDeals.map((item, i) => {
  const { deal, stageName, summary } = item;
  return `### ${i + 1}. ${deal.name}
- **ID:** ${deal.id}
- **Value:** ${formatValue(deal)}
- **Stage:** ${stageName}
- **Confidence:** ${deal.confidence ? `${Math.round(parseFloat(deal.confidence) * 100)}%` : 'N/A'}
- **Close Date:** ${deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'N/A'}
- **Company:** ${formatCompany(deal)}
- **Recent Activity:** ${formatSummary(summary)}
- **Last Activity:** ${summary.lastActivity ? new Date(summary.lastActivity).toLocaleString() : 'N/A'}
`;
}).join('\n')}`;

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
            text: `Error finding active deals: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
