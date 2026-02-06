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
    where: 'JSON string with filter conditions using MongoDB-style $-prefixed operators (e.g., {"name": {"$contains": "Acme"}}). Supports dot notation for nested/JSONB fields (e.g., {"location.city": "San Francisco"}) and date modifiers (e.g., {"closeDate:month": "2026-01", "closeDate:quarter": "2026-01"}). Use direct value for exact match (e.g., {"stage": "id"}).',
    limit: 'Max records to return (default: 100)',
    offset: 'Pagination offset (default: 0)',
    orderBy: 'JSON string for sort order (e.g., {"createdAt": "desc"})',
  },

  deleteOptions: {
    archive: 'Set to true for soft delete (sets archivedAt), false for hard delete',
  },

  // MongoDB-style query operators (all prefixed with $)
  whereOperators: [
    // Comparison
    '$lt',        // Less than: {"value": {"$lt": 1000}}
    '$lte',       // Less than or equal: {"value": {"$lte": 5000}}
    '$gt',        // Greater than: {"value": {"$gt": 1000}}
    '$gte',       // Greater than or equal: {"value": {"$gte": 1000}}
    '$between',   // Between range: {"value": {"$between": [1000, 5000]}}
    // Array/set membership
    '$in',        // Value in array: {"stage": {"$in": ["id1", "id2"]}}
    '$notIn',     // Value not in array: {"stage": {"$notIn": ["id1"]}}
    '$includes',  // Array field includes value: {"ownerIds": {"$includes": "userId"}}
    '$overlaps',  // Array field overlaps with values: {"custom.fieldId": {"$overlaps": ["val1", "val2"]}}
    // String matching
    '$contains',  // String contains: {"name": {"$contains": "YC"}}
    '$startsWith',// String starts with
    '$endsWith',  // String ends with
    // Logical
    '$not',       // Negation
    '$or',        // OR clauses: {"$or": [{"stage": "a"}, {"stage": "b"}]}
  ],
};
