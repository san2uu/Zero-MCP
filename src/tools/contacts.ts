import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, buildQueryParams, formatApiError, formatDate } from '../services/api.js';
import { Contact, ApiListResponse } from '../types.js';
import { buildIncludeFields, formatIncludedRelations } from '../services/relations.js';

export const contactTools = {
  zero_list_contacts: {
    description: 'List contacts in Zero CRM with optional filtering and pagination. Use the "where" parameter for filtering (e.g., {"email": {"$contains": "@acme.com"}}, {"companyId": "uuid"}). Use "include" to fetch related data inline (e.g., ["company", "deals", "tasks"]). Tip: To find contacts with recent meetings, use zero_list_calendar_events with a date filter, fetchAll: true, and include: ["contacts"] — a unique contacts summary is appended automatically.',
    inputSchema: z.object({
      where: z.record(z.unknown()).optional().describe('Filter conditions using $-prefixed operators (e.g., {"email": {"$contains": "@acme.com"}}, {"companyId": "uuid"})'),
      limit: z.number().int().min(1).max(1000).optional().default(20).describe('Max records to return (default: 20, max: 1000)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (min: 0)'),
      orderBy: z.record(z.enum(['asc', 'desc'])).optional().describe('Sort order (e.g., {"lastName": "asc"})'),
      fields: z.string().optional().describe('Comma-separated fields to include (use company.name for related data)'),
      includeCompany: z.boolean().optional().default(true).describe('Include company details (legacy, prefer "include" param)'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: company, deals, tasks, notes, emailThreads, calendarEvents, activities, comments'),
    }),
    handler: async (args: { where?: Record<string, unknown>; limit?: number; offset?: number; orderBy?: Record<string, 'asc' | 'desc'>; fields?: string; includeCompany?: boolean; include?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.include && args.include.length > 0) {
          // When using include, build fields from the include list
          if (!fields) {
            fields = 'id,firstName,lastName,email,phone,title,companyId,createdAt,updatedAt';
          }
          fields = buildIncludeFields('contact', args.include, fields);
        } else if (args.includeCompany !== false && !fields) {
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

${contacts.map((c, i) => {
  let entry = `### ${i + 1}. ${c.firstName} ${c.lastName}
- **ID:** ${c.id}
- **Email:** ${c.email || 'N/A'}
- **Phone:** ${c.phone || 'N/A'}
- **Title:** ${c.title || 'N/A'}
- **Company:** ${c.company?.name || 'N/A'}
`;
  if (args.include && args.include.length > 0) {
    entry += formatIncludedRelations('contact', c as unknown as Record<string, unknown>, args.include);
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
            text: `Error listing contacts: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_get_contact: {
    description: 'Get a single contact by ID with full details. Use "include" to fetch related data inline (e.g., ["company", "deals", "tasks"]).',
    inputSchema: z.object({
      id: z.string().uuid().describe('The contact ID'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
      include: z.array(z.string()).optional().describe('Related entities to include inline: company, deals, tasks, notes, emailThreads, calendarEvents, activities, comments'),
    }),
    handler: async (args: { id: string; fields?: string; include?: string[] }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        let fields = args.fields;
        if (args.include && args.include.length > 0) {
          if (!fields) {
            fields = 'id,firstName,lastName,email,phone,title,linkedin,companyId,createdAt,updatedAt,archivedAt';
          }
          fields = buildIncludeFields('contact', args.include, fields);
        } else if (!fields) {
          fields = 'id,firstName,lastName,email,phone,title,linkedin,companyId,company.id,company.name,createdAt,updatedAt,archivedAt';
        }

        const params: Record<string, string> = { workspaceId };
        if (fields) params.fields = fields;

        const response = await client.get(`/api/contacts/${args.id}`, { params });
        const contact: Contact = (response.data as any).data || response.data;

        let markdown = `## ${contact.firstName} ${contact.lastName}

**ID:** ${contact.id}
**Email:** ${contact.email || 'N/A'}
**Phone:** ${contact.phone || 'N/A'}
**Title:** ${contact.title || 'N/A'}
**LinkedIn:** ${contact.linkedin || 'N/A'}

### Company
${contact.company ? `**${contact.company.name}** (${contact.company.id})` : 'No company associated'}

### Timestamps
- **Created:** ${formatDate(contact.createdAt)}
- **Updated:** ${formatDate(contact.updatedAt)}
${contact.archivedAt ? `- **Archived:** ${formatDate(contact.archivedAt)}` : ''}`;

        if (args.include && args.include.length > 0) {
          markdown += formatIncludedRelations('contact', contact as unknown as Record<string, unknown>, args.include);
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
      linkedin: z.string().optional().describe('LinkedIn profile URL'),
      companyId: z.string().optional().describe('Company ID to associate with'),
    }),
    handler: async (args: { firstName: string; lastName: string; email?: string; phone?: string; title?: string; linkedin?: string; companyId?: string }) => {
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
**Created:** ${formatDate(contact.createdAt)}`,
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
      id: z.string().uuid().describe('The contact ID to update'),
      firstName: z.string().optional().describe('First name'),
      lastName: z.string().optional().describe('Last name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      title: z.string().optional().describe('Job title'),
      linkedin: z.string().optional().describe('LinkedIn profile URL'),
      companyId: z.string().optional().describe('Company ID to associate with'),
    }),
    handler: async (args: { id: string; firstName?: string; lastName?: string; email?: string; phone?: string; title?: string; linkedin?: string; companyId?: string }) => {
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
**Updated:** ${formatDate(contact.updatedAt)}`,
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

  zero_resolve_contacts: {
    description: 'Resolve multiple contacts by their IDs in a single call. Useful for bulk-resolving contact IDs from calendar events, email threads, etc. Returns contact details for all found IDs. Some IDs may not resolve (e.g., internal workspace members). Note: Some contact IDs from calendar events may resolve to email-only records (no name) if the attendee hasn\'t been fully enriched in the CRM. Maximum 500 IDs per request.',
    inputSchema: z.object({
      ids: z.array(z.string().uuid()).min(1).max(500).describe('Array of contact IDs to resolve (max 500)'),
      fields: z.string().optional().describe('Comma-separated fields to include'),
    }),
    handler: async (args: { ids: string[]; fields?: string }) => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const uniqueIds = [...new Set(args.ids.filter(Boolean))];
        if (uniqueIds.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No contact IDs provided.',
            }],
          };
        }

        const fields = args.fields || 'id,firstName,lastName,email,phone,title,companyId,company.id,company.name,createdAt';

        const params = buildQueryParams({
          workspaceId,
          where: { id: { $in: uniqueIds } },
          limit: uniqueIds.length,
          fields,
        });

        const response = await client.get<ApiListResponse<Contact>>('/api/contacts', { params });
        const contacts = response.data.data || [];

        const resolvedIds = new Set(contacts.map((c: Contact) => c.id));
        const unresolvedIds = uniqueIds.filter((id) => !resolvedIds.has(id));

        if (contacts.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: `No contacts found for ${uniqueIds.length} ID(s). These may be internal workspace members or deleted contacts.`,
            }],
          };
        }

        const markdown = `## Resolved Contacts (${contacts.length} of ${uniqueIds.length} IDs)

${contacts.map((c: Contact, i: number) => `### ${i + 1}. ${c.firstName} ${c.lastName}
- **ID:** ${c.id}
- **Email:** ${c.email || 'N/A'}
- **Phone:** ${c.phone || 'N/A'}
- **Title:** ${c.title || 'N/A'}
- **Company:** ${c.company?.name || 'N/A'}
`).join('\n')}
${unresolvedIds.length > 0 ? `\n### Unresolved IDs (${unresolvedIds.length})\nThese may be internal workspace members or deleted contacts:\n${unresolvedIds.map((id) => `- ${id}`).join('\n')}` : ''}`;

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
            text: `Error resolving contacts: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_delete_contact: {
    description: 'Delete or archive a contact in Zero CRM.',
    inputSchema: z.object({
      id: z.string().uuid().describe('The contact ID to delete'),
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
