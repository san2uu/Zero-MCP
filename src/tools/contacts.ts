import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError } from '../services/api.js';
import { Contact, ApiListResponse } from '../types.js';

export const contactTools = {
  zero_list_contacts: {
    description: 'List contacts in Zero CRM with optional filtering and pagination. Use the "where" parameter for filtering (e.g., {"email": {"contains": "@acme.com"}}).',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions as JSON object'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"lastName": "asc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include (use company.name for related data)'),
      includeCompany: z.boolean().optional().default(true).describe('Include company details'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string; includeCompany?: boolean }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.includeCompany !== false && !fields) {
          fields = 'id,firstName,lastName,email,phone,title,companyId,company.id,company.name,createdAt,updatedAt';
        }

        const params = buildQueryParams({
          workspaceId,
          where: args.where,
          limit: args.limit || 20,
          offset: args.offset || 0,
          orderBy: args.orderBy,
          fields,
        });

        const response = await client.get<ApiListResponse<Contact>>('/api/contacts', { params });
        const contacts = response.data.data || [];
        const total = response.data.total;
        const limit = args.limit || 20;
        const offset = args.offset || 0;
        const hasMore = total ? offset + contacts.length < total : contacts.length === limit;

        if (contacts.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No contacts found matching your criteria.',
            }],
          };
        }

        const markdown = `## Contacts (${contacts.length}${total ? ` of ${total}` : ''})

${contacts.map((c, i) => `### ${i + 1}. ${c.firstName} ${c.lastName}
- **ID:** ${c.id}
- **Email:** ${c.email || 'N/A'}
- **Phone:** ${c.phone || 'N/A'}
- **Title:** ${c.title || 'N/A'}
- **Company:** ${c.company?.name || 'N/A'}
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
            text: `Error listing contacts: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_contact: {
    description: 'Get a single contact by ID with full details.',
    inputSchema: z.object({
      id: z.string().describe('The contact ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { id: string; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = { workspaceId };
        if (args.fields) {
          params.fields = args.fields;
        } else {
          params.fields = 'id,firstName,lastName,email,phone,title,linkedinUrl,companyId,company.id,company.name,createdAt,updatedAt,archivedAt';
        }

        const response = await client.get<Contact>(`/api/contacts/${args.id}`, { params });
        const contact = response.data;

        const markdown = `## ${contact.firstName} ${contact.lastName}

**ID:** ${contact.id}
**Email:** ${contact.email || 'N/A'}
**Phone:** ${contact.phone || 'N/A'}
**Title:** ${contact.title || 'N/A'}
**LinkedIn:** ${contact.linkedinUrl || 'N/A'}

### Company
${contact.company ? `**${contact.company.name}** (${contact.company.id})` : 'No company associated'}

### Timestamps
- **Created:** ${new Date(contact.createdAt).toLocaleString()}
- **Updated:** ${new Date(contact.updatedAt).toLocaleString()}
${contact.archivedAt ? `- **Archived:** ${new Date(contact.archivedAt).toLocaleString()}` : ''}`;

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
            text: `Error getting contact: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_create_contact: {
    description: 'Create a new contact in Zero CRM. Optionally associate with a company by ID.',
    inputSchema: z.object({
      firstName: z.string().describe('First name (required)'),
      lastName: z.string().describe('Last name (required)'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      title: z.string().optional().describe('Job title'),
      linkedinUrl: z.string().optional().describe('LinkedIn URL'),
      companyId: z.string().optional().describe('Company ID to associate with'),
    }),
    handler: async (args: { firstName: string; lastName: string; email?: string; phone?: string; title?: string; linkedinUrl?: string; companyId?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const response = await client.post<Contact>('/api/contacts', {
          ...args,
          workspaceId,
        });

        const contact = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Contact Created Successfully

**Name:** ${contact.firstName} ${contact.lastName}
**ID:** ${contact.id}
**Email:** ${contact.email || 'N/A'}
**Created:** ${new Date(contact.createdAt).toLocaleString()}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error creating contact: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_update_contact: {
    description: 'Update an existing contact in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The contact ID to update'),
      firstName: z.string().optional().describe('First name'),
      lastName: z.string().optional().describe('Last name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      title: z.string().optional().describe('Job title'),
      linkedinUrl: z.string().optional().describe('LinkedIn URL'),
      companyId: z.string().optional().describe('Company ID to associate with'),
    }),
    handler: async (args: { id: string; firstName?: string; lastName?: string; email?: string; phone?: string; title?: string; linkedinUrl?: string; companyId?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const { id, ...updateData } = args;

        const response = await client.patch<Contact>(`/api/contacts/${id}`, {
          ...updateData,
          workspaceId,
        });

        const contact = response.data;

        return {
          content: [{
            type: 'text' as const,
            text: `## Contact Updated Successfully

**Name:** ${contact.firstName} ${contact.lastName}
**ID:** ${contact.id}
**Updated:** ${new Date(contact.updatedAt).toLocaleString()}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error updating contact: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_delete_contact: {
    description: 'Delete or archive a contact in Zero CRM.',
    inputSchema: z.object({
      id: z.string().describe('The contact ID to delete'),
      archive: z.boolean().optional().default(true).describe('If true, soft delete (archive). If false, permanently delete.'),
    }),
    handler: async (args: { id: string; archive?: boolean }) => {
      try {
        const client = createApiClient();

        const params: Record<string, string> = {};
        if (args.archive !== false) {
          params.archive = 'true';
        }

        await client.delete(`/api/contacts/${args.id}`, { params });

        const action = args.archive !== false ? 'archived' : 'permanently deleted';

        return {
          content: [{
            type: 'text' as const,
            text: `Contact ${args.id} has been ${action}.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error deleting contact: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
