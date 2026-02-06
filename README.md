# Zero MCP Server

An MCP (Model Context Protocol) server for integrating [Zero CRM](https://zero.inc) with Claude Desktop and other MCP-compatible clients.

## Features

- **16 tools** for full CRUD operations on companies, contacts, and deals
- **Single workspace mode** - automatically caches workspace ID
- **Smart filtering** - use JSON `where` clauses for powerful queries
- **Pagination** - built-in `limit`/`offset` support
- **Formatted output** - Markdown responses for readability

## Installation

```bash
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zero": {
      "command": "node",
      "args": ["/path/to/zero-api/dist/index.js"],
      "env": {
        "ZERO_API_KEY": "your-api-key-here",
        "ZERO_WORKSPACE_NAME": "My Workspace"
      }
    }
  }
}
```

Replace `/path/to/zero-api` with the actual path and add your Zero API key.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZERO_API_KEY` | Yes | Your Zero API key |
| `ZERO_WORKSPACE_NAME` | No | Workspace name to use (defaults to first workspace) |

### Getting Your Zero API Key

Request an API key from the Zero team. Self-service API key generation is not yet available.

## Available Tools

### Workspace
- `zero_get_workspace` - Get and cache the default workspace

### Companies
- `zero_list_companies` - List/search companies with filtering
- `zero_get_company` - Get company by ID
- `zero_create_company` - Create a new company
- `zero_update_company` - Update company fields
- `zero_delete_company` - Archive or delete a company

### Contacts
- `zero_list_contacts` - List/search contacts with filtering
- `zero_get_contact` - Get contact by ID
- `zero_create_contact` - Create a new contact
- `zero_update_contact` - Update contact fields
- `zero_delete_contact` - Archive or delete a contact

### Deals
- `zero_list_deals` - List/search deals with filtering
- `zero_get_deal` - Get deal by ID
- `zero_create_deal` - Create a new deal
- `zero_update_deal` - Update deal fields
- `zero_delete_deal` - Archive or delete a deal

## Usage Examples

Once configured, you can ask Claude:

- "What workspace am I connected to?"
- "List all my companies"
- "Show deals over $50k in negotiation"
- "Create a contact for Acme Corp"
- "Update deal X to stage 'closed won'"

### Filtering

Tools support JSON `where` clauses:

```json
{"name": {"contains": "Acme"}}
{"value": {"gte": 50000}}
{"stage": "negotiation"}
```

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build for production
```

## API Reference

This server integrates with Zero's REST API. See `src/api-reference.ts` for documented endpoints.

**Note:** Zero is in beta. When they update their API, update this MCP accordingly.

## License

MIT
