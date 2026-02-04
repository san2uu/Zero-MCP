#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { workspaceTools } from './tools/workspaces.js';
import { companyTools } from './tools/companies.js';
import { contactTools } from './tools/contacts.js';
import { dealTools } from './tools/deals.js';

const server = new McpServer({
  name: 'zero-crm',
  version: '1.0.0',
});

// Register workspace tools
server.tool(
  'zero_get_workspace',
  workspaceTools.zero_get_workspace.description,
  workspaceTools.zero_get_workspace.inputSchema.shape,
  workspaceTools.zero_get_workspace.handler
);

// Register company tools
server.tool(
  'zero_list_companies',
  companyTools.zero_list_companies.description,
  companyTools.zero_list_companies.inputSchema.shape,
  companyTools.zero_list_companies.handler
);

server.tool(
  'zero_get_company',
  companyTools.zero_get_company.description,
  companyTools.zero_get_company.inputSchema.shape,
  companyTools.zero_get_company.handler
);

server.tool(
  'zero_create_company',
  companyTools.zero_create_company.description,
  companyTools.zero_create_company.inputSchema.shape,
  companyTools.zero_create_company.handler
);

server.tool(
  'zero_update_company',
  companyTools.zero_update_company.description,
  companyTools.zero_update_company.inputSchema.shape,
  companyTools.zero_update_company.handler
);

server.tool(
  'zero_delete_company',
  companyTools.zero_delete_company.description,
  companyTools.zero_delete_company.inputSchema.shape,
  companyTools.zero_delete_company.handler
);

// Register contact tools
server.tool(
  'zero_list_contacts',
  contactTools.zero_list_contacts.description,
  contactTools.zero_list_contacts.inputSchema.shape,
  contactTools.zero_list_contacts.handler
);

server.tool(
  'zero_get_contact',
  contactTools.zero_get_contact.description,
  contactTools.zero_get_contact.inputSchema.shape,
  contactTools.zero_get_contact.handler
);

server.tool(
  'zero_create_contact',
  contactTools.zero_create_contact.description,
  contactTools.zero_create_contact.inputSchema.shape,
  contactTools.zero_create_contact.handler
);

server.tool(
  'zero_update_contact',
  contactTools.zero_update_contact.description,
  contactTools.zero_update_contact.inputSchema.shape,
  contactTools.zero_update_contact.handler
);

server.tool(
  'zero_delete_contact',
  contactTools.zero_delete_contact.description,
  contactTools.zero_delete_contact.inputSchema.shape,
  contactTools.zero_delete_contact.handler
);

// Register deal tools
server.tool(
  'zero_list_deals',
  dealTools.zero_list_deals.description,
  dealTools.zero_list_deals.inputSchema.shape,
  dealTools.zero_list_deals.handler
);

server.tool(
  'zero_get_deal',
  dealTools.zero_get_deal.description,
  dealTools.zero_get_deal.inputSchema.shape,
  dealTools.zero_get_deal.handler
);

server.tool(
  'zero_create_deal',
  dealTools.zero_create_deal.description,
  dealTools.zero_create_deal.inputSchema.shape,
  dealTools.zero_create_deal.handler
);

server.tool(
  'zero_update_deal',
  dealTools.zero_update_deal.description,
  dealTools.zero_update_deal.inputSchema.shape,
  dealTools.zero_update_deal.handler
);

server.tool(
  'zero_delete_deal',
  dealTools.zero_delete_deal.description,
  dealTools.zero_delete_deal.inputSchema.shape,
  dealTools.zero_delete_deal.handler
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Zero MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
