import { z } from 'zod';
import { createApiClient, getCachedWorkspaceId, setCachedWorkspaceId, formatApiError } from '../services/api.js';
import { Workspace } from '../types.js';

export const workspaceTools = {
  zero_get_workspace: {
    description: 'Get the default workspace for this Zero account. The workspace is automatically cached for subsequent API calls.',
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

        const workspace = workspaces[0];
        setCachedWorkspaceId(workspace.id);

        const markdown = `## Workspace: ${workspace.name}

**ID:** ${workspace.id}
**Created:** ${new Date(workspace.createdAt).toLocaleDateString()}
**Status:** ${cached ? 'Already cached' : 'Now cached for subsequent calls'}

${workspaces.length > 1 ? `\n*Note: ${workspaces.length} workspaces available. Using the first one.*` : ''}`;

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
};
