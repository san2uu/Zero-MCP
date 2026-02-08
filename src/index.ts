#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { workspaceTools } from './tools/workspaces.js';
import { companyTools } from './tools/companies.js';
import { contactTools } from './tools/contacts.js';
import { dealTools } from './tools/deals.js';
import { pipelineStageTools } from './tools/pipeline-stages.js';
import { taskTools } from './tools/tasks.js';
import { noteTools } from './tools/notes.js';
import { activityTools } from './tools/activities.js';
import { emailThreadTools } from './tools/email-threads.js';
import { calendarEventTools } from './tools/calendar-events.js';
import { commentTools } from './tools/comments.js';
import { issueTools } from './tools/issues.js';
import { listTools } from './tools/lists.js';
import { activeDealTools } from './tools/active-deals.js';


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

server.tool(
  'zero_list_workspaces',
  workspaceTools.zero_list_workspaces.description,
  workspaceTools.zero_list_workspaces.inputSchema.shape,
  workspaceTools.zero_list_workspaces.handler
);

server.tool(
  'zero_switch_workspace',
  workspaceTools.zero_switch_workspace.description,
  workspaceTools.zero_switch_workspace.inputSchema.shape,
  workspaceTools.zero_switch_workspace.handler
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
  'zero_resolve_contacts',
  contactTools.zero_resolve_contacts.description,
  contactTools.zero_resolve_contacts.inputSchema.shape,
  contactTools.zero_resolve_contacts.handler
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

// Register pipeline stage tools
server.tool(
  'zero_list_pipeline_stages',
  pipelineStageTools.zero_list_pipeline_stages.description,
  pipelineStageTools.zero_list_pipeline_stages.inputSchema.shape,
  pipelineStageTools.zero_list_pipeline_stages.handler
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

// Register task tools
server.tool(
  'zero_list_tasks',
  taskTools.zero_list_tasks.description,
  taskTools.zero_list_tasks.inputSchema.shape,
  taskTools.zero_list_tasks.handler
);

server.tool(
  'zero_get_task',
  taskTools.zero_get_task.description,
  taskTools.zero_get_task.inputSchema.shape,
  taskTools.zero_get_task.handler
);

server.tool(
  'zero_create_task',
  taskTools.zero_create_task.description,
  taskTools.zero_create_task.inputSchema.shape,
  taskTools.zero_create_task.handler
);

server.tool(
  'zero_update_task',
  taskTools.zero_update_task.description,
  taskTools.zero_update_task.inputSchema.shape,
  taskTools.zero_update_task.handler
);

server.tool(
  'zero_delete_task',
  taskTools.zero_delete_task.description,
  taskTools.zero_delete_task.inputSchema.shape,
  taskTools.zero_delete_task.handler
);

// Register note tools
server.tool(
  'zero_list_notes',
  noteTools.zero_list_notes.description,
  noteTools.zero_list_notes.inputSchema.shape,
  noteTools.zero_list_notes.handler
);

server.tool(
  'zero_get_note',
  noteTools.zero_get_note.description,
  noteTools.zero_get_note.inputSchema.shape,
  noteTools.zero_get_note.handler
);

server.tool(
  'zero_create_note',
  noteTools.zero_create_note.description,
  noteTools.zero_create_note.inputSchema.shape,
  noteTools.zero_create_note.handler
);

server.tool(
  'zero_update_note',
  noteTools.zero_update_note.description,
  noteTools.zero_update_note.inputSchema.shape,
  noteTools.zero_update_note.handler
);

server.tool(
  'zero_delete_note',
  noteTools.zero_delete_note.description,
  noteTools.zero_delete_note.inputSchema.shape,
  noteTools.zero_delete_note.handler
);

// Register activity tools
server.tool(
  'zero_list_activities',
  activityTools.zero_list_activities.description,
  activityTools.zero_list_activities.inputSchema.shape,
  activityTools.zero_list_activities.handler
);

server.tool(
  'zero_get_activity',
  activityTools.zero_get_activity.description,
  activityTools.zero_get_activity.inputSchema.shape,
  activityTools.zero_get_activity.handler
);

// Register email thread tools
server.tool(
  'zero_list_email_threads',
  emailThreadTools.zero_list_email_threads.description,
  emailThreadTools.zero_list_email_threads.inputSchema.shape,
  emailThreadTools.zero_list_email_threads.handler
);

server.tool(
  'zero_get_email_thread',
  emailThreadTools.zero_get_email_thread.description,
  emailThreadTools.zero_get_email_thread.inputSchema.shape,
  emailThreadTools.zero_get_email_thread.handler
);

// Register calendar event tools
server.tool(
  'zero_list_calendar_events',
  calendarEventTools.zero_list_calendar_events.description,
  calendarEventTools.zero_list_calendar_events.inputSchema.shape,
  calendarEventTools.zero_list_calendar_events.handler
);

server.tool(
  'zero_get_calendar_event',
  calendarEventTools.zero_get_calendar_event.description,
  calendarEventTools.zero_get_calendar_event.inputSchema.shape,
  calendarEventTools.zero_get_calendar_event.handler
);

// Register comment tools
server.tool(
  'zero_list_comments',
  commentTools.zero_list_comments.description,
  commentTools.zero_list_comments.inputSchema.shape,
  commentTools.zero_list_comments.handler
);

server.tool(
  'zero_get_comment',
  commentTools.zero_get_comment.description,
  commentTools.zero_get_comment.inputSchema.shape,
  commentTools.zero_get_comment.handler
);

server.tool(
  'zero_create_comment',
  commentTools.zero_create_comment.description,
  commentTools.zero_create_comment.inputSchema.shape,
  commentTools.zero_create_comment.handler
);

server.tool(
  'zero_update_comment',
  commentTools.zero_update_comment.description,
  commentTools.zero_update_comment.inputSchema.shape,
  commentTools.zero_update_comment.handler
);

server.tool(
  'zero_delete_comment',
  commentTools.zero_delete_comment.description,
  commentTools.zero_delete_comment.inputSchema.shape,
  commentTools.zero_delete_comment.handler
);

// Register issue tools (Slack messages via Pylon/Plain)
server.tool(
  'zero_list_issues',
  issueTools.zero_list_issues.description,
  issueTools.zero_list_issues.inputSchema.shape,
  issueTools.zero_list_issues.handler
);

server.tool(
  'zero_get_issue',
  issueTools.zero_get_issue.description,
  issueTools.zero_get_issue.inputSchema.shape,
  issueTools.zero_get_issue.handler
);

// Register list tools
server.tool(
  'zero_list_lists',
  listTools.zero_list_lists.description,
  listTools.zero_list_lists.inputSchema.shape,
  listTools.zero_list_lists.handler
);

server.tool(
  'zero_get_list',
  listTools.zero_get_list.description,
  listTools.zero_get_list.inputSchema.shape,
  listTools.zero_get_list.handler
);

// Register composite tools
server.tool(
  'zero_find_active_deals',
  activeDealTools.zero_find_active_deals.description,
  activeDealTools.zero_find_active_deals.inputSchema.shape,
  activeDealTools.zero_find_active_deals.handler
);

async function main() {
  // Validate required environment variables at startup
  if (!process.env.ZERO_API_KEY) {
    console.error('Fatal error: ZERO_API_KEY environment variable is required');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Zero MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
