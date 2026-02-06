# CLAUDE.md

## Project Overview

MCP (Model Context Protocol) server that exposes Zero CRM (api.zero.inc) as tools for AI assistants. Built with TypeScript, `@modelcontextprotocol/sdk`, Zod, and Axios.

## Commands

- `npm run build` — TypeScript compilation (tsc)
- `npm test` — Run all tests (vitest)
- `npm run dev` — Watch mode for development
- `npm start` — Start the MCP server on stdio

## Architecture

```
src/
  index.ts              # Server entry point, registers all tools
  types.ts              # TypeScript interfaces for all entities
  api-reference.ts      # Zero API endpoint documentation
  services/
    api.ts              # Axios client, workspace caching, query helpers
    relations.ts        # Relational query support (include param)
  tools/
    workspaces.ts       # Workspace tools (get, list, switch)
    companies.ts        # Company CRUD + include support
    contacts.ts         # Contact CRUD + include support
    deals.ts            # Deal CRUD + include support
    pipeline-stages.ts  # Pipeline stage listing
    tasks.ts            # Task CRUD
    notes.ts            # Note CRUD
    activities.ts       # Activity read-only (list, get)
    email-threads.ts    # Email thread read-only (list, get)
    calendar-events.ts  # Calendar event read-only (list, get)
    comments.ts         # Comment CRUD
    issues.ts           # Issue read-only (list, get) — Slack messages via Pylon/Plain
    lists.ts            # List read-only (list, get)
    active-deals.ts     # Composite: find deals with recent activity across all sources
  __tests__/
    tools.test.ts       # Integration tests with mocked HTTP
```

## Key Patterns

**Tool structure:** Each tool file exports an object (e.g., `companyTools`) containing named tools. Each tool has `{ description, inputSchema (Zod), handler }`. Registration in `index.ts` uses `server.tool(name, description, schema.shape, handler)`.

**Workspace caching:** `ensureWorkspaceId()` auto-fetches and caches the workspace ID on first call. `ZERO_WORKSPACE_NAME` env var selects a preferred workspace.

**Query params:** `buildQueryParams()` serializes `where` and `orderBy` as JSON strings. The `where` param uses MongoDB-style `$`-prefixed operators (`$contains`, `$gte`, `$in`, etc.).

**Relational queries:** Companies, contacts, and deals support an `include: string[]` parameter that appends dot-notation relation fields to the API request and renders related data as markdown. The relations service (`services/relations.ts`) maps entity types to available relations and their fields.

**Content fields:** Tasks, notes, and comments have content/description fields typed as `string | Record<string, unknown>`. Display with `JSON.stringify` if object.

**Response shape:** Get endpoints may wrap in `{ data: entity }` — use `response.data.data || response.data` defensively.

**Deal enrichment:** Deals auto-resolve stage IDs to names via cached pipeline stages. Company location is enriched via a secondary `fetchCompaniesByIds()` call unless `include` already contains `"company"`.

**Entity associations:** Activities, email threads, calendar events, and issues all expose `dealId`, `companyId`, `contactId` in their output. This enables correlation back to deals/companies/contacts.

**Composite tools:** `zero_find_active_deals` queries all activity sources (activities, emailThreads, calendarEvents, issues) in parallel with a date filter, collects dealIds, and returns enriched deals with per-deal activity summary. Handles source failures gracefully.

**Issues:** Slack messages synced via Pylon/Plain are exposed as "issues" (`/api/issues`). The Issue entity has title, description, status, priority, source, and entity association fields.

**Legacy params:** `includeCompany` (contacts) and `includeRelations` (deals) still work when `include` is absent. When `include` is provided, it supersedes them.

## Testing

Tests mock axios at the module level (`vi.mock('axios')`) with `mockGet`/`mockPost`/`mockPatch`/`mockDelete`. Each test sets up `setCachedWorkspaceId` and `setCachedPipelineStages` in `beforeEach` to avoid workspace/stage fetch calls.

## Environment Variables

- `ZERO_API_KEY` (required) — API key for Zero CRM authentication
- `ZERO_WORKSPACE_NAME` (optional) — Preferred workspace name to auto-select
