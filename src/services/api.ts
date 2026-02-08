import axios, { AxiosInstance, AxiosError } from 'axios';
import { ListParams } from '../types.js';

const BASE_URL = 'https://api.zero.inc';

/**
 * Safely formats a date string to locale format.
 * Returns 'Invalid Date' if the date string is invalid.
 */
export function formatDate(dateString: string | undefined, format: 'string' | 'date' = 'string'): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format === 'date' ? date.toLocaleDateString() : date.toLocaleString();
  } catch {
    return 'Invalid Date';
  }
}

let cachedWorkspaceId: string | null = null;
let cachedPipelineStages: Map<string, string> | null = null;

export function getCachedWorkspaceId(): string | null {
  return cachedWorkspaceId;
}

export function setCachedWorkspaceId(id: string): void {
  cachedWorkspaceId = id;
}

export function createApiClient(): AxiosInstance {
  const apiKey = process.env.ZERO_API_KEY;

  if (!apiKey) {
    throw new Error('ZERO_API_KEY environment variable is not set');
  }

  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // Explicitly require valid HTTPS certificates
    httpsAgent: undefined, // Use default agent with rejectUnauthorized: true
    validateStatus: (status) => status < 600, // Allow axios to handle all HTTP status codes
  });

  return client;
}

function transformWhereClause(where: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [field, condition] of Object.entries(where)) {
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const cond = condition as Record<string, unknown>;
      if ('$gte' in cond && ('$lte' in cond || '$lt' in cond)) {
        const { $gte, $lte, $lt, ...rest } = cond;
        result[field] = { ...rest, $between: [$gte, $lte ?? $lt] };
      } else {
        result[field] = condition;
      }
    } else {
      result[field] = condition;
    }
  }
  return result;
}

export function buildQueryParams(params: ListParams): Record<string, string> {
  const query: Record<string, string> = {};

  if (params.workspaceId) {
    query.workspaceId = params.workspaceId;
  }
  if (params.fields) {
    query.fields = params.fields;
  }
  if (params.where) {
    query.where = JSON.stringify(transformWhereClause(params.where));
  }
  if (params.limit !== undefined) {
    query.limit = String(params.limit);
  }
  if (params.offset !== undefined) {
    query.offset = String(params.offset);
  }
  if (params.orderBy) {
    query.orderBy = JSON.stringify(params.orderBy);
  }

  return query;
}

export function formatApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      return 'Authentication failed. Please check your API credentials.';
    }
    if (status === 403) {
      return 'Access denied. You may not have permission for this workspace or resource.';
    }
    if (status === 404) {
      return 'Resource not found. The requested item may have been deleted.';
    }
    if (status === 422) {
      // Sanitize validation errors - only show safe field names, not full backend messages
      const message = data?.message || data?.error || '';
      const safeMessage = typeof message === 'string' ? message.substring(0, 200) : 'Invalid input';
      return `Validation error: ${safeMessage}`;
    }
    if (status === 429) {
      return 'Rate limit exceeded. Please wait before making more requests.';
    }
    if (status && status >= 500) {
      return `Server error (${status}). Please try again later.`;
    }

    // Generic client error - don't expose internal details
    return `Request failed (${status || 'unknown'}). Please check your input and try again.`;
  }

  if (error instanceof Error) {
    // Don't expose stack traces or internal error details
    return 'An error occurred while processing your request.';
  }

  return 'An unknown error occurred';
}

export function clearWorkspaceCaches(): void {
  cachedPipelineStages = null;
}

export function setCachedPipelineStages(stages: Map<string, string>): void {
  cachedPipelineStages = stages;
}

export function getCachedPipelineStages(): Map<string, string> | null {
  return cachedPipelineStages;
}

export async function resolveStageName(stageId: string | undefined): Promise<string> {
  if (!stageId) return 'N/A';

  // Try cache first
  if (cachedPipelineStages) {
    return cachedPipelineStages.get(stageId) || stageId;
  }

  // Fetch and cache pipeline stages
  try {
    const workspaceId = await ensureWorkspaceId();
    const client = createApiClient();
    const params: Record<string, string> = {
      where: JSON.stringify({ workspaceId }),
    };
    const response = await client.get('/api/pipelineStages', { params });
    const stages = response.data.data || response.data;
    const stageMap = new Map<string, string>();
    for (const stage of stages) {
      stageMap.set(stage.id, stage.name);
    }
    cachedPipelineStages = stageMap;
    return stageMap.get(stageId) || stageId;
  } catch {
    return stageId;
  }
}

export async function fetchCompaniesByIds(companyIds: string[]): Promise<Map<string, { name?: string; city?: string; country?: string }>> {
  const map = new Map<string, { name?: string; city?: string; country?: string }>();
  const uniqueIds = [...new Set(companyIds.filter(Boolean))];
  if (uniqueIds.length === 0) return map;

  try {
    const workspaceId = await ensureWorkspaceId();
    const client = createApiClient();
    const params = buildQueryParams({
      workspaceId,
      where: { id: { $in: uniqueIds } },
      limit: uniqueIds.length,
    });
    const response = await client.get('/api/companies', { params });
    const companies = response.data.data || [];
    for (const c of companies) {
      // Handle both flat fields (city, country) and nested (location.city, location.country)
      const city = c.city || c.location?.city;
      const country = c.country || c.location?.country;
      map.set(c.id, { name: c.name, city, country });
    }
  } catch {
    // If enrichment fails, return empty map — deals still display without location
  }

  return map;
}

export async function ensureWorkspaceId(): Promise<string> {
  if (cachedWorkspaceId) {
    return cachedWorkspaceId;
  }

  const client = createApiClient();
  const response = await client.get('/api/workspaces');
  const workspaces = response.data.data || response.data;

  if (!workspaces || workspaces.length === 0) {
    throw new Error('No workspaces found. Please create a workspace in Zero first.');
  }

  // Check for preferred workspace name from environment
  const preferredName = process.env.ZERO_WORKSPACE_NAME;
  let workspace = workspaces[0];

  if (preferredName) {
    const found = workspaces.find((w: { name: string }) => w.name === preferredName);
    if (found) {
      workspace = found;
    }
  }

  const workspaceId = workspace.id;
  cachedWorkspaceId = workspaceId;
  return workspaceId;
}
