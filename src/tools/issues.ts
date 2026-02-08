import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, formatDate } from '../services/api.js';
import { Issue, ApiListResponse } from '../types.js';

function formatContent(value: unknown): string {
  if (value == null) return 'N/A';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export const issueTools = {
  zero_list_issues: {
    description: 'List issues (Slack messages synced via Pylon/Plain) in Zero CRM with optional filtering and pagination. Each issue has companyIds, contactIds (plural arrays) for entity association. Filter examples: {"companyIds": {"$contains": "uuid"}}, {"contactIds": {"$contains": "uuid"}}, {"status": "open"}, {"createdAt": {"$gte": "2026-02-03"}}.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions (e.g., {"companyIds": {"$contains": "uuid"}}, {"createdAt": {"$gte": "2026-02-03"}})'),
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

        const response = await client.get<ApiListResponse<Issue>>('/api/issues', { params });
        const issues = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + issues.length < total : issues.length === limit;

        if (issues.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No issues found matching your criteria.',
            }],
          };
        }

        const markdown = `## Issues (${issues.length}${total ? ` of ${total}` : ''})

${issues.map((issue, i) => `### ${i + 1}. ${issue.name || 'Untitled'}
- **ID:** ${issue.id}
- **Status:** ${issue.status || 'N/A'}
- **Priority:** ${issue.priority != null ? issue.priority : 'N/A'}
- **Source:** ${issue.source || 'N/A'}
- **Description:** ${formatContent(issue.description)}
${issue.channel ? `- **Channel:** ${issue.channel}` : ''}
${issue.link ? `- **Link:** ${issue.link}` : ''}
${issue.companyIds?.length ? `- **Company IDs:** ${issue.companyIds.join(', ')}` : ''}
${issue.contactIds?.length ? `- **Contact IDs:** ${issue.contactIds.join(', ')}` : ''}
- **Created:** ${new Date(issue.createdAt).toLocaleString()}
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
            text: `Error listing issues: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_issue: {
    description: 'Get a single issue (Slack message) by ID with full details.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The issue ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) params.fields = args.fields;

        const response = await client.get(`/api/issues/${args.id}`, { params });
        const issue: Issue = response.data.data || response.data;

        const markdown = `## ${issue.name || 'Untitled Issue'}

**ID:** ${issue.id}
**Status:** ${issue.status || 'N/A'}
**Priority:** ${issue.priority != null ? issue.priority : 'N/A'}
**Source:** ${issue.source || 'N/A'}
**Description:** ${formatContent(issue.description)}
${issue.channel ? `**Channel:** ${issue.channel}` : ''}
${issue.link ? `**Link:** ${issue.link}` : ''}

### Associations
${issue.companyIds?.length ? `- **Company IDs:** ${issue.companyIds.join(', ')}` : '- **Companies:** None'}
${issue.contactIds?.length ? `- **Contact IDs:** ${issue.contactIds.join(', ')}` : '- **Contacts:** None'}

### Timestamps
- **Created:** ${new Date(issue.createdAt).toLocaleString()}
- **Updated:** ${new Date(issue.updatedAt).toLocaleString()}
${issue.archivedAt ? `- **Archived:** ${new Date(issue.archivedAt).toLocaleString()}` : ''}`;

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
            text: `Error getting issue: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
