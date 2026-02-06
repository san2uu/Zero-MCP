import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Company, ApiListResponse } from '../types.js';
import { buildIncludeFields, formatIncludedRelations } from '../services/relations.js';

export const companyTools = {
  zero_list_companies: {
    description: 'List companies in Zero CRM with optional filtering and pagination. Use the "where" parameter for filtering (e.g., {"name": {"$contains": "Acme"}}, {"location.city": "San Francisco"}, {"location.country": "United States"}). Use "include" to fetch related data inline (e.g., ["tasks", "contacts", "deals"]).',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions using $-prefixed operators (e.g., {"name": {"$contains": "Acme"}}, {"location.city": "San Francisco"})'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
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
- **Industry:** ${c.industry || 'N/A'}
- **Size:** ${c.size || 'N/A'}
- **Location:** ${[c.city || c.location?.city, c.state || c.location?.state, c.country || c.location?.country].filter(Boolean).join(', ') || 'N/A'}
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
      id: z.string().describe('The company ID'),
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
**Industry:** ${company.industry || 'N/A'}
**Size:** ${company.size || 'N/A'}
**Website:** ${company.website || 'N/A'}
**LinkedIn:** ${company.linkedinUrl || 'N/A'}
**Phone:** ${company.phone || 'N/A'}

### Address
${company.address || company.location?.address || ''}
${[company.city || company.location?.city, company.state || company.location?.state, company.postalCode || company.location?.postalCode].filter(Boolean).join(', ')}
${company.country || company.location?.country || ''}

### Description
${company.description || 'No description'}

### Timestamps
- **Created:** ${new Date(company.createdAt).toLocaleString()}
- **Updated:** ${new Date(company.updatedAt).toLocaleString()}
${company.archivedAt ? `- **Archived:** ${new Date(company.archivedAt).toLocaleString()}` : ''}`;

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
    description: 'Create a new company in Zero CRM.',
    inputSchema: z.object({
      name: z.string().describe('Company name (required)'),
      domain: z.string().optional().describe('Company domain/website'),
      industry: z.string().optional().describe('Industry'),
      size: z.string().optional().describe('Company size'),
      description: z.string().optional().describe('Company description'),
      website: z.string().optional().describe('Website URL'),
      linkedinUrl: z.string().optional().describe('LinkedIn URL'),
      address: z.string().optional().describe('Street address'),
      city: z.string().optional().describe('City'),
      state: z.string().optional().describe('State/Province'),
      country: z.string().optional().describe('Country'),
      postalCode: z.string().optional().describe('Postal/ZIP code'),
      phone: z.string().optional().describe('Phone number'),
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
**Created:** ${new Date(company.createdAt).toLocaleString()}`,
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
    description: 'Update an existing company in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The company ID to update'),
      name: z.string().optional().describe('Company name'),
      domain: z.string().optional().describe('Company domain/website'),
      industry: z.string().optional().describe('Industry'),
      size: z.string().optional().describe('Company size'),
      description: z.string().optional().describe('Company description'),
      website: z.string().optional().describe('Website URL'),
      linkedinUrl: z.string().optional().describe('LinkedIn URL'),
      address: z.string().optional().describe('Street address'),
      city: z.string().optional().describe('City'),
      state: z.string().optional().describe('State/Province'),
      country: z.string().optional().describe('Country'),
      postalCode: z.string().optional().describe('Postal/ZIP code'),
      phone: z.string().optional().describe('Phone number'),
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
      id: z.string().describe('The company ID to delete'),
      archive: z.boolean().optional().default(true).describe('If true, soft delete (archive). If false, permanently delete.'),
    }),
    handler: async (args: { id: string; archive?: boolean }) => {
      try {
        const client = createApiClient();

        const params: Record<string, string> = {};
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
