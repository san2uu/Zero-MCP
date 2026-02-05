import { z } from 'zod';
import { createApiClient, ensureWorkspaceId, formatApiError, setCachedPipelineStages } from '../services/api.js';
import { PipelineStage, ApiListResponse } from '../types.js';

export const pipelineStageTools = {
  zero_list_pipeline_stages: {
    description: 'List pipeline stages in Zero CRM. Use this to discover stage IDs, which are needed to filter deals by stage. Stages are referenced by ID (not name) throughout the API.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const workspaceId = await ensureWorkspaceId();
        const client = createApiClient();

        const params: Record<string, string> = {
          where: JSON.stringify({ workspaceId }),
        };

        const response = await client.get<ApiListResponse<PipelineStage>>('/api/pipelineStages', { params });
        const stages = response.data.data || response.data;

        if (!Array.isArray(stages) || stages.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: 'No pipeline stages found.',
            }],
          };
        }

        // Cache for stage name resolution
        const stageMap = new Map<string, string>();
        for (const stage of stages) {
          stageMap.set(stage.id, stage.name);
        }
        setCachedPipelineStages(stageMap);

        const sorted = [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        const markdown = `## Pipeline Stages (${sorted.length})

${sorted.map((s, i) => `${i + 1}. **${s.name}** — ID: \`${s.id}\``).join('\n')}

*Use these stage IDs to filter deals, e.g.: zero_list_deals with where: {"stage": "<stage_id>"}*`;

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
            text: `Error listing pipeline stages: ${formatApiError(error)}`,
          }],
          isError: true,
        };
      }
    },
  },
};
