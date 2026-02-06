import { z } from 'zod';
import { createApiClient, getCachedWorkspaceId, setCachedWorkspaceId, clearWorkspaceCaches, formatApiError } from '../services/api.js';
import { Workspace } from '../types.js';

export const workspaceTools = {
  zero_get_workspace: {
    description: 'Get the current active workspace for this Zero account. The workspace is automatically cached for subsequent API calls.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const cached = getCachedWorkspaceId();
        const client = createApiClient();
        const response = await client.get('/api/workspaces');
        const workspaces: Workspace[] = response.data.data || response.data;

        if (!workspaces || workspaces.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No workspaces found. Please create a workspace in Zero first.',
            }],
          };
        }

        // Check for preferred workspace name from environment
        const preferredName = process.env.ZERO_WORKSPACE_NAME;
        let workspace = workspaces[0];

        if (preferredName) {
          const found = workspaces.find((w: Workspace) => w.name === preferredName);
          if (found) {
            workspace = found;
          }
        }

        setCachedWorkspaceId(workspace.id);

        const markdown = `## Workspace: ${workspace.name}

**ID:** ${workspace.id}
**Created:** ${new Date(workspace.createdAt).toLocaleDateString()}
**Status:** ${cached ? 'Already cached' : 'Now cached for subsequent calls'}

${workspaces.length > 1 ? `\n*Note: ${workspaces.length} workspaces available. Use \`zero_list_workspaces\` to see all, and \`zero_switch_workspace\` to switch.*` : ''}`;

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
            text: `Error fetching workspace: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_list_workspaces: {
    description: 'List all available workspaces in this Zero account. Shows which workspace is currently active.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const client = createApiClient();
        const response = await client.get('/api/workspaces');
        const workspaces: Workspace[] = response.data.data || response.data;

        if (!workspaces || workspaces.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No workspaces found. Please create a workspace in Zero first.',
            }],
          };
        }

        const currentId = getCachedWorkspaceId();

        const lines = workspaces.map((w: Workspace) => {
          const active = w.id === currentId ? ' **(active)**' : '';
          return `- **${w.name}**${active}\n  ID: ${w.id} | Created: ${new Date(w.createdAt).toLocaleDateString()}`;
        });

        const markdown = `## Workspaces (${workspaces.length})\n\n${lines.join('\n')}\n\n*Use \`zero_switch_workspace\` with a workspace name to switch.*`;

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
            text: `Error listing workspaces: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },

  zero_switch_workspace: {
    description: 'Switch to a different workspace by name. All subsequent API calls will use the new workspace. Pipeline stage caches are cleared automatically.',
    inputSchema: z.object({
      name: z.string().describe('The name of the workspace to switch to'),
    }),
    handler: async ({ name }: { name: string }) => {
      try {
        const client = createApiClient();
        const response = await client.get('/api/workspaces');
        const workspaces: Workspace[] = response.data.data || response.data;

        if (!workspaces || workspaces.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No workspaces found. Please create a workspace in Zero first.',
            }],
            isError: true,
          };
        }

        const target = workspaces.find((w: Workspace) => w.name.toLowerCase() === name.toLowerCase());

        if (!target) {
          const available = workspaces.map((w: Workspace) => w.name).join(', ');
          return {
            content: [{
              type: 'text' as const,
              text: `Workspace "${name}" not found. Available workspaces: ${available}`,
            }],
            isError: true,
          };
        }

        const previousId = getCachedWorkspaceId();
        setCachedWorkspaceId(target.id);
        clearWorkspaceCaches();

        const markdown = previousId === target.id
          ? `Already on workspace **${target.name}**. No change needed.`
          : `Switched to workspace **${target.name}** (${target.id}). All subsequent calls will use this workspace.`;

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
            text: `Error switching workspace: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
