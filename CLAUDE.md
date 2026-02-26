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
    contacts.ts         # Contact CRUD + include support + bulk resolve
    deals.ts            # Deal CRUD + include support
    pipeline-stages.ts  # Pipeline stage listing
    tasks.ts            # Task CRUD
    notes.ts            # Note CRUD
    activities.ts       # Activity read-only (list, get)
    email-threads.ts    # Email thread read-only (list, get)
    calendar-events.ts  # Calendar event read-only (list, get) + include support
    comments.ts         # Comment CRUD
    issues.ts           # Issue read-only (list, get) — Slack messages via Pylon/Plain
    lists.ts            # List read-only (list, get)
    columns.ts          # Column (custom property definitions) read-only (list)
    active-deals.ts     # Composite: find deals with recent activity across all sources
  __tests__/
    tools.test.ts       # Integration tests with mocked HTTP
```

## Key Patterns

**Tool structure:** Each tool file exports an object (e.g., `companyTools`) containing named tools. Each tool has `{ description, inputSchema (Zod), handler }`. Registration in `index.ts` uses `server.tool(name, description, schema.shape, handler)`.

**Workspace caching:** `ensureWorkspaceId()` auto-fetches and caches the workspace ID on first call. `ZERO_WORKSPACE_NAME` env var selects a preferred workspace.

**Query params:** `buildQueryParams()` serializes `where` and `orderBy` as JSON strings. The `where` param uses MongoDB-style `$`-prefixed operators (`$contains`, `$gte`, `$in`, etc.).

**Relational queries:** Companies, contacts, deals, and calendar events support an `include: string[]` parameter that appends dot-notation relation fields to the API request and renders related data as markdown. The relations service (`services/relations.ts`) maps entity types to available relations and their fields.

**Content fields:** Tasks, notes, and comments have content/description fields typed as `string | Record<string, unknown>`. Display with `JSON.stringify` if object.

**Response shape:** Get endpoints may wrap in `{ data: entity }` — use `response.data.data || response.data` defensively.

**Deal enrichment:** Deals auto-resolve stage IDs to names via cached pipeline stages. Company location is enriched via a secondary `fetchCompaniesByIds()` call unless `include` already contains `"company"`.

**Entity associations:** Email threads and calendar events use plural array fields (`dealIds`, `companyIds`, `contactIds`). Activities use `companyIds`/`contactIds` but have no direct deal link. Issues use `companyIds`/`contactIds` with no deal link. Always refer to `SCHEMA_AND_RELATIONS.md` for the canonical field names.

**Bulk contact resolve:** `zero_resolve_contacts` takes an array of contact IDs and returns their details in one call using `$in` filter. Reports which IDs couldn't be resolved (may be internal workspace members).

**Calendar event includes:** `zero_list_calendar_events` and `zero_get_calendar_event` support `include: ["contacts", "companies", "tasks"]` to resolve related entities inline instead of just returning ID arrays.

**Composite tools:** `zero_find_active_deals` queries activity sources in parallel with a date filter. Only emailThreads and calendarEvents contribute direct deal associations (via `dealIds` arrays). Activities and issues are queried but cannot be correlated to deals directly. Handles source failures gracefully.

**Columns:** `zero_list_columns` returns custom property definitions (id, name, type, entity, options). Use to discover custom field IDs before filtering/updating records with `custom` properties or `where` conditions like `{"custom.fieldId": {"$eq": "value"}}`.

**Contact name field:** Contacts use a single `name` field (not `firstName`/`lastName`).

**Company location:** Companies use a nested `location` object (`city`, `state`, `country`, `address`, `postalCode`, `continent`, `countryCode`, `stateCode`, `coordinates`). No flat address fields.

**Deal confidence:** The `confidence` field on deals is a number between 0 and 1 (not a string).

**Custom properties:** Companies, contacts, and deals support a `custom: Record<string, unknown>` field for custom properties. Use `zero_list_columns` to discover field IDs. Filter with dot notation: `{"custom.fieldId": {"$eq": "value"}}`.

**Issues:** Slack messages synced via Pylon/Plain are exposed as "issues" (`/api/issues`). The Issue entity has title, description, status, priority, source, and entity association fields.

**Calendar event deduplication:** `zero_list_calendar_events` has a `deduplicate` param (default: `true`) that merges duplicate events sharing the same name + startTime (truncated to minute). Merged events union their array fields (`contactIds`, `companyIds`, `dealIds`, `userIds`, `attendeeEmails`). The output header shows duplicate count when dedup is active.

**Calendar event fetchAll:** `zero_list_calendar_events` supports `fetchAll: true` to auto-paginate through all matching events (page size 200, safety cap 500). When `fetchAll` is true, `limit`/`offset` are ignored. Use with a date range filter. When combined with `include: ["contacts"]` and 2+ events, a unique contacts summary is appended at the bottom, separating named contacts from email-only contacts.

**Legacy params:** `includeCompany` (contacts) and `includeRelations` (deals) still work when `include` is absent. When `include` is provided, it supersedes them.

## Design Principles

**Prefer composable primitives over single-purpose composite tools.** The MCP client (Claude/LLM) is capable of orchestrating multi-step queries by chaining existing tools. Don't create a new tool for every question pattern users might have — instead, make the existing tools expressive enough (with `include`, `where`, `$in`, `$contains`, etc.) so the client can answer complex questions by combining them. Only create composite tools when the orchestration requires server-side logic that the client genuinely cannot perform (e.g., `zero_find_active_deals` queries 4 sources in parallel and correlates results through company associations — something impractical for the client to do in a single turn).

**Enrich tool descriptions** with example multi-tool workflows so the MCP client knows how to compose them. For instance, "who did we meet this week?" is answered by `zero_list_calendar_events` with a date filter + `include: ["contacts"]` — no dedicated tool needed.

## Testing

Tests mock axios at the module level (`vi.mock('axios')`) with `mockGet`/`mockPost`/`mockPatch`/`mockDelete`. Each test sets up `setCachedWorkspaceId` and `setCachedPipelineStages` in `beforeEach` to avoid workspace/stage fetch calls.

## Environment Variables

- `ZERO_API_KEY` (required) — API key for Zero CRM authentication
- `ZERO_WORKSPACE_NAME` (optional) — Preferred workspace name to auto-select
