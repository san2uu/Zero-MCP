import axios, { AxiosInstance, AxiosError } from 'axios';
import { ListParams } from '../types.js';

const BASE_URL = 'https://api.zero.inc';

let cachedWorkspaceId: string | null = null;

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
  });

  return client;
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
    query.where = JSON.stringify(params.where);
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
      return 'Authentication failed. Please check your ZERO_API_KEY.';
    }
    if (status === 403) {
      return 'Access denied. You may not have permission for this workspace or resource.';
    }
    if (status === 404) {
      return 'Resource not found. The requested item may have been deleted.';
    }
    if (status === 422) {
      const message = data?.message || data?.error || 'Validation error';
      return `Validation error: ${message}`;
    }
    if (status === 429) {
      return 'Rate limit exceeded. Please wait before making more requests.';
    }

    return `API error (${status}): ${data?.message || data?.error || error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
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

  const workspaceId = workspaces[0].id;
  cachedWorkspaceId = workspaceId;
  return workspaceId;
}
