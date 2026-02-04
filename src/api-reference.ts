// Zero API Reference
// Extracted from: docs.zero.inc
// API Version: Beta
// Last synced: 2024-01-15
//
// When Zero updates their API, update this file and the corresponding
// tool implementations. If Zero provides an OpenAPI spec in the future,
// consider auto-generating the MCP tools.

export const API_REFERENCE = {
  version: 'beta',
  lastSynced: '2024-01-15',
  baseUrl: 'https://api.zero.inc',

  endpoints: {
    workspaces: {
      path: '/api/workspaces',
      methods: ['GET'],
      description: 'List workspaces the authenticated user has access to',
    },
    companies: {
      list: { path: '/api/companies', methods: ['GET', 'POST'] },
      single: { path: '/api/companies/{id}', methods: ['PATCH', 'DELETE'] },
    },
    contacts: {
      list: { path: '/api/contacts', methods: ['GET', 'POST'] },
      single: { path: '/api/contacts/{id}', methods: ['PATCH', 'DELETE'] },
    },
    deals: {
      list: { path: '/api/deals', methods: ['GET', 'POST'] },
      single: { path: '/api/deals/{id}', methods: ['PATCH', 'DELETE'] },
    },
  },

  commonQueryParams: {
    workspaceId: 'UUID - Filter by workspace (required for most calls)',
    fields: 'Comma-separated field names, dot notation for relations (e.g., "id,name,company.name")',
    where: 'JSON string with filter conditions (e.g., {"name": {"contains": "Acme"}})',
    limit: 'Max records to return (default: 100)',
    offset: 'Pagination offset (default: 0)',
    orderBy: 'JSON string for sort order (e.g., {"createdAt": "desc"})',
  },

  deleteOptions: {
    archive: 'Set to true for soft delete (sets archivedAt), false for hard delete',
  },

  whereOperators: [
    'equals',
    'not',
    'in',
    'notIn',
    'lt',
    'lte',
    'gt',
    'gte',
    'contains',
    'startsWith',
    'endsWith',
  ],
};
