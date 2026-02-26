import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, formatDate } from '../services/api.js';
import { Company, ApiListResponse } from '../types.js';
import { buildIncludeFields, formatIncludedRelations } from '../services/relations.js';

export const companyTools = {
  zero_list_companies: {
    description: 'List companies in Zero CRM with optional filtering and pagination. Use the "where" parameter for filtering (e.g., {"name": {"$contains": "Acme"}}, {"location.city": "San Francisco"}, {"location.country": "United States"}). Use "include" to fetch related data inline (e.g., ["tasks", "contacts", "deals"]).',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions using $-prefixed operators (e.g., {"name": {"$contains": "Acme"}}, {"location.city": "San Francisco"})'),
      limit: z.number().int().min(1).max(1000).optional().default(20).describe('Max records to return (default: 20, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (min: 0)'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"createdAt": "desc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: contacts, deals, tasks, notes, emailThreads, calendarEvents, activities, comments'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string; include?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.include && args.include.length > 0) {
          fields = buildIncludeFields('company', args.include, fields);
        }

        const params = buildQueryParams({
          workspaceId,
          where: args.where,
          limit: args.limit || 20,
          offset: args.offset || 0,
          orderBy: args.orderBy,
          fields,
        });

        const response = await client.get<ApiListResponse<Company>>('/api/companies', { params });
        const companies = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + companies.length < total : companies.length === limit;

        if (companies.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No companies found matching your criteria.',
            }],
          };
        }

        const markdown = `## Companies (${companies.length}${total ? ` of ${total}` : ''})

${companies.map((c, i) => {
  let entry = `### ${i + 1}. ${c.name}
- **ID:** ${c.id}
- **Domain:** ${c.domain || 'N/A'}
- **Location:** ${[c.location?.city, c.location?.state, c.location?.country].filter(Boolean).join(', ') || 'N/A'}
`;
  if (args.include && args.include.length > 0) {
    entry += formatIncludedRelations('company', c as unknown as Record<string, unknown>, args.include);
  }
  return entry;
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
            text: `Error listing companies: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_company: {
    description: 'Get a single company by ID with full details. Use "include" to fetch related data inline (e.g., ["tasks", "contacts", "deals"]).',
    inputSchema: z.object({
      id: z.string().uuid().describe('The company ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: contacts, deals, tasks, notes, emailThreads, calendarEvents, activities, comments'),
    }),
    handler: async (args: { id: string; fields?: string; include?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.include && args.include.length > 0) {
          fields = buildIncludeFields('company', args.include, fields);
        }

        const params: Record<string, string> = { workspaceId };
        if (fields) params.fields = fields;

        const response = await client.get<Company>(`/api/companies/${args.id}`, { params });
        const company = response.data;

        let markdown = `## ${company.name}

**ID:** ${company.id}
**Domain:** ${company.domain || 'N/A'}
**LinkedIn:** ${company.linkedin || 'N/A'}
**Logo:** ${company.logo || 'N/A'}

### Location
${company.location?.address || ''}
${[company.location?.city, company.location?.state, company.location?.postalCode].filter(Boolean).join(', ')}
${company.location?.country || ''}

### Description
${company.description || 'No description'}

### Timestamps
- **Created:** ${formatDate(company.createdAt)}
- **Updated:** ${formatDate(company.updatedAt)}
${company.archived ? '- **Archived:** yes' : ''}`;

        if (args.include && args.include.length > 0) {
          markdown += formatIncludedRelations('company', company as unknown as Record<string, unknown>, args.include);
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
            text: `Error getting company: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_create_company: {
    description: 'Create a new company in Zero CRM. Use "custom" for custom properties (use zero_list_columns to find field IDs first).',
    inputSchema: z.object({
      name: z.string().describe('Company name (required)'),
      domain: z.string().optional().describe('Company domain (e.g., "acme.com")'),
      logo: z.string().optional().describe('Logo URL'),
      description: z.string().optional().describe('Company description'),
      linkedin: z.string().optional().describe('LinkedIn profile URL'),
      location: z.object({
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      }).optional().describe('Company location'),
      listIds: z.array(z.string()).optional().describe('List IDs to add the company to'),
      ownerIds: z.array(z.string()).optional().describe('Owner user IDs'),
      parentCompanyId: z.string().optional().describe('Parent company ID'),
      custom: z.record(z.unknown()).optional().describe('Custom properties (use column IDs as keys, e.g., {"col_abc123": "value"})'),
      externalId: z.string().optional().describe('External system ID'),
      source: z.string().optional().describe('Source of the company record'),
    }),
    handler: async (args: Partial<Company> & { name: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const response = await client.post<Company>('/api/companies', {
          ...args,
          workspaceId,
        });

        const company = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Company Created Successfully

**Name:** ${company.name}
**ID:** ${company.id}
**Created:** ${formatDate(company.createdAt)}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error creating company: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_update_company: {
    description: 'Update an existing company in Zero CRM. Use "custom" for custom properties (use zero_list_columns to find field IDs first). You can also update custom properties individually via dot notation in the request body (e.g., {"custom.fieldId": "new value"}).',
    inputSchema: z.object({
      id: z.string().uuid().describe('The company ID to update'),
      name: z.string().optional().describe('Company name'),
      domain: z.string().optional().describe('Company domain'),
      logo: z.string().optional().describe('Logo URL'),
      description: z.string().optional().describe('Company description'),
      linkedin: z.string().optional().describe('LinkedIn profile URL'),
      location: z.object({
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
      }).optional().describe('Company location'),
      listIds: z.array(z.string()).optional().describe('List IDs'),
      ownerIds: z.array(z.string()).optional().describe('Owner user IDs'),
      parentCompanyId: z.string().optional().describe('Parent company ID'),
      custom: z.record(z.unknown()).optional().describe('Custom properties (use column IDs as keys)'),
      externalId: z.string().optional().describe('External system ID'),
      source: z.string().optional().describe('Source of the company record'),
    }),
    handler: async (args: { id: string } & Partial<Company>) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const { id, ...updateData } = args;

        const response = await client.patch<Company>(`/api/companies/${id}`, {
          ...updateData,
          workspaceId,
        });

        const company = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Company Updated Successfully

**Name:** ${company.name}
**ID:** ${company.id}
**Updated:** ${new Date(company.updatedAt).toLocaleString()}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error updating company: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_delete_company: {
    description: 'Delete or archive a company in Zero CRM.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The company ID to delete'),
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

        await client.delete(`/api/companies/${args.id}`, { params });

        const action = args.archive !== false ? 'archived' : 'permanently deleted';

        return {
          content: [{
            type: 'text' as const,
            text: `Company ${args.id} has been ${action}.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error deleting company: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
