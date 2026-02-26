// Zero API Reference
// Extracted from: docs.zero.inc
// API Version: 1.3.0
// Last synced: 2026-02-26
//
// When Zero updates their API, update this file and the corresponding
// tool implementations. If Zero provides an OpenAPI spec in the future,
// consider auto-generating the MCP tools.

export const API_REFERENCE = {
  version: '1.3.0',
  lastSynced: '2026-02-26',
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
    tasks: {
      list: { path: '/api/tasks', methods: ['GET', 'POST'] },
      single: { path: '/api/tasks/{id}', methods: ['PATCH', 'DELETE'] },
    },
    notes: {
      list: { path: '/api/notes', methods: ['GET', 'POST'] },
      single: { path: '/api/notes/{id}', methods: ['PATCH', 'DELETE'] },
    },
    activities: {
      list: { path: '/api/activities', methods: ['GET'] },
      single: { path: '/api/activities/{id}', methods: ['GET'] },
    },
    emailThreads: {
      list: { path: '/api/emailThreads', methods: ['GET'] },
      single: { path: '/api/emailThreads/{id}', methods: ['GET'] },
    },
    calendarEvents: {
      list: { path: '/api/calendarEvents', methods: ['GET'] },
      single: { path: '/api/calendarEvents/{id}', methods: ['GET'] },
    },
    comments: {
      list: { path: '/api/comments', methods: ['GET', 'POST'] },
      single: { path: '/api/comments/{id}', methods: ['PATCH', 'DELETE'] },
    },
    issues: {
      list: { path: '/api/issues', methods: ['GET'] },
      single: { path: '/api/issues/{id}', methods: ['GET'] },
    },
    lists: {
      list: { path: '/api/lists', methods: ['GET'] },
      single: { path: '/api/lists/{id}', methods: ['GET'] },
    },
    columns: {
      path: '/api/columns',
      methods: ['GET'],
      description: 'List custom property definitions (columns) for the workspace',
    },
  },

  commonQueryParams: {
    workspaceId: 'UUID - Filter by workspace (required for most calls)',
    fields: 'Comma-separated field names, dot notation for relations (e.g., "id,name,company.name")',
    where: 'JSON string with filter conditions using MongoDB-style $-prefixed operators (e.g., {"name": {"$contains": "Acme"}}). Supports dot notation for nested/JSONB fields (e.g., {"location.city": "San Francisco"}), date modifiers (e.g., {"closeDate:month": "2026-01", "closeDate:quarter": "2026-01"}), and custom property filtering via dot notation (e.g., {"custom.fieldId": {"$eq": "value"}}). Use direct value for exact match (e.g., {"stage": "id"}).',
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
    '$eq',        // Exact match: {"name": {"$eq": "Acme"}}
    '$lt',        // Less than: {"value": {"$lt": 1000}}
    '$lte',       // Less than or equal: {"value": {"$lte": 5000}}
    '$gt',        // Greater than: {"value": {"$gt": 1000}}
    '$gte',       // Greater than or equal: {"value": {"$gte": 1000}}
    '$between',   // Between range: {"value": {"$between": [1000, 5000]}}
    // Array/set membership
    '$in',        // Value in array: {"stage": {"$in": ["id1", "id2"]}}
    '$notIn',     // Value not in array: {"stage": {"$notIn": ["id1"]}}
    '$includes',  // Array field includes value: {"ownerIds": {"$includes": "userId"}}
    '$notIncludes', // Array field does not include value: {"ownerIds": {"$notIncludes": "userId"}}
    '$overlaps',  // Array field overlaps with values: {"custom.fieldId": {"$overlaps": ["val1", "val2"]}}
    '$notOverlaps', // Array field does not overlap with values
    '$all',       // Array field contains all values: {"tags": {"$all": ["a", "b"]}}
    '$length',    // Array field length: {"contactIds": {"$length": 3}}
    // String matching
    '$contains',     // String contains: {"name": {"$contains": "YC"}}
    '$notContains',  // String does not contain: {"name": {"$notContains": "test"}}
    '$containsAny',  // String contains any of: {"name": {"$containsAny": ["YC", "Acme"]}}
    '$startsWith',   // String starts with
    '$endsWith',     // String ends with
    // Existence
    '$exists',    // Field exists (is not null): {"email": {"$exists": true}}
    '$notExists', // Field does not exist (is null): {"email": {"$notExists": true}}
    // Date
    '$date',      // Date comparison: {"createdAt": {"$date": {"$gte": "2026-01-01"}}}
    // Logical
    '$not',       // Negation
    '$or',        // OR clauses: {"$or": [{"stage": "a"}, {"stage": "b"}]}
    '$and',       // AND clauses: {"$and": [{"value": {"$gte": 1000}}, {"value": {"$lte": 5000}}]}
  ],

  // Relative time macros for date filters (used inside $gte, $lte, etc.)
  relativeTimeMacros: [
    '$now',            // Current timestamp
    '$startOfToday',   // Start of today (00:00:00)
    '$endOfToday',     // End of today (23:59:59)
    '$startOfWeek',    // Start of current week
    '$endOfWeek',      // End of current week
    '$startOfMonth',   // Start of current month
    '$endOfMonth',     // End of current month
    '$startOfQuarter', // Start of current quarter
    '$endOfQuarter',   // End of current quarter
    '$startOfYear',    // Start of current year
    '$endOfYear',      // End of current year
    // Example: {"closeDate": {"$gte": "$startOfMonth", "$lte": "$endOfMonth"}}
  ],
};
