import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { AxiosInstance } from 'axios';

// Mock axios before any imports that use it
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

const mockClient: Partial<AxiosInstance> = {
  get: mockGet,
  post: mockPost,
  patch: mockPatch,
  delete: mockDelete,
};

vi.mock('axios', () => ({
  default: {
    create: () => mockClient,
  },
  AxiosError: class AxiosError extends Error {
    response?: { status: number; data?: unknown };
    constructor(message: string, _code?: string, _config?: unknown, _request?: unknown, response?: { status: number; data?: unknown }) {
      super(message);
      this.name = 'AxiosError';
      this.response = response;
    }
  },
}));

import { workspaceTools } from '../tools/workspaces.js';
import { companyTools } from '../tools/companies.js';
import { contactTools } from '../tools/contacts.js';
import { dealTools } from '../tools/deals.js';
import { pipelineStageTools } from '../tools/pipeline-stages.js';
import { setCachedWorkspaceId, setCachedPipelineStages } from '../services/api.js';
import { AxiosError } from 'axios';

const WORKSPACE_ID = 'ws-001';

beforeAll(() => {
  process.env.ZERO_API_KEY = 'test-key-123';
});

beforeEach(() => {
  vi.clearAllMocks();
  setCachedWorkspaceId(WORKSPACE_ID);
  setCachedPipelineStages(new Map([
    ['stage-id-1', 'Prospecting'],
    ['stage-id-2', 'Qualification'],
    ['stage-id-3', 'Closed Won'],
  ]));
});

// ─── 1. "What workspace am I connected to?" ─────────────────────────────────

describe('zero_get_workspace', () => {
  it('returns workspace name and ID', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: WORKSPACE_ID, name: 'My CRM', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
      },
    });

    const result = await workspaceTools.zero_get_workspace.handler();
    const text = result.content[0].text;

    expect(text).toContain('My CRM');
    expect(text).toContain(WORKSPACE_ID);
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 2. "List all my companies" ──────────────────────────────────────────────

describe('zero_list_companies', () => {
  it('lists companies with no filters', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-1', name: 'Acme Corp', domain: 'acme.com', industry: 'Tech', size: '100', city: 'SF', state: 'CA', country: 'US', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'co-2', name: 'Globex Inc', domain: 'globex.com', industry: 'Finance', size: '500', city: 'NYC', state: 'NY', country: 'US', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await companyTools.zero_list_companies.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Acme Corp');
    expect(text).toContain('Globex Inc');
    expect(text).toContain('Companies (2 of 2)');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 3. "Find companies with 'Acme' in the name" ────────────────────────────

describe('zero_list_companies — name filter', () => {
  it('passes $contains filter to API as JSON string', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-1', name: 'Acme Corp', domain: 'acme.com', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const where = { name: { $contains: 'Acme' } };
    const result = await companyTools.zero_list_companies.handler({ where });
    const text = result.content[0].text;

    expect(text).toContain('Acme Corp');

    // Verify the where param was serialized as JSON
    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });
});

// ─── 4. "Show me all pipeline stages" ───────────────────────────────────────

describe('zero_list_pipeline_stages', () => {
  it('lists stage names and IDs', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'stage-id-1', workspaceId: WORKSPACE_ID, name: 'Prospecting', position: 1, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'stage-id-2', workspaceId: WORKSPACE_ID, name: 'Qualification', position: 2, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'stage-id-3', workspaceId: WORKSPACE_ID, name: 'Closed Won', position: 3, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
      },
    });

    const result = await pipelineStageTools.zero_list_pipeline_stages.handler();
    const text = result.content[0].text;

    expect(text).toContain('Prospecting');
    expect(text).toContain('Qualification');
    expect(text).toContain('Closed Won');
    expect(text).toContain('stage-id-1');
    expect(text).toContain('Pipeline Stages (3)');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 5. "Show deals over $50k" ──────────────────────────────────────────────

describe('zero_list_deals — value filter', () => {
  it('returns deals with formatted USD values', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-1', name: 'Big Deal', value: 75000, stage: 'stage-id-2', confidence: '0.80', closeDate: '2026-06-01T00:00:00Z', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'd-2', name: 'Mega Deal', value: 120000, stage: 'stage-id-3', confidence: '0.95', closeDate: '2026-03-15T00:00:00Z', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const where = { value: { $gte: 50000 } };
    const result = await dealTools.zero_list_deals.handler({ where });
    const text = result.content[0].text;

    expect(text).toContain('Big Deal');
    expect(text).toContain('Mega Deal');
    expect(text).toContain('$75,000.00');
    expect(text).toContain('$120,000.00');
    expect(text).toContain('Qualification');
    expect(text).toContain('Closed Won');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 6. "Show deals closing this month" ─────────────────────────────────────

describe('zero_list_deals — date modifier filter', () => {
  it('passes closeDate:month filter correctly', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-3', name: 'Feb Deal', value: 10000, stage: 'stage-id-1', closeDate: '2026-02-15T00:00:00Z', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const where = { 'closeDate:month': '2026-02' };
    const result = await dealTools.zero_list_deals.handler({ where });
    const text = result.content[0].text;

    expect(text).toContain('Feb Deal');

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });
});

// ─── 7. "List deals in a specific stage" ────────────────────────────────────

describe('zero_list_deals — $in operator', () => {
  it('passes $in filter for multiple stages', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-4', name: 'Deal A', value: 5000, stage: 'stage-id-1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'd-5', name: 'Deal B', value: 8000, stage: 'stage-id-2', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const where = { stage: { $in: ['stage-id-1', 'stage-id-2'] } };
    const result = await dealTools.zero_list_deals.handler({ where });
    const text = result.content[0].text;

    expect(text).toContain('Deal A');
    expect(text).toContain('Deal B');

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });
});

// ─── 8. "Get details for a specific deal" ───────────────────────────────────

describe('zero_get_deal', () => {
  it('returns deal with name, value, stage name, and company', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          id: 'd-1',
          name: 'Enterprise Deal',
          value: 250000,
          stage: 'stage-id-3',
          confidence: '0.90',
          closeDate: '2026-06-01T00:00:00Z',
          company: { id: 'co-1', name: 'Acme Corp' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
      },
    });

    const result = await dealTools.zero_get_deal.handler({ id: 'd-1' });
    const text = result.content[0].text;

    expect(text).toContain('Enterprise Deal');
    expect(text).toContain('$250,000.00');
    expect(text).toContain('Closed Won');
    expect(text).toContain('Acme Corp');
    expect(result).not.toHaveProperty('isError');

    expect(mockGet).toHaveBeenCalledWith('/api/deals/d-1', expect.objectContaining({
      params: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
    }));
  });
});

// ─── 9. "Create a new contact at Acme" ──────────────────────────────────────

describe('zero_create_contact', () => {
  it('creates a contact and returns success', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: 'ct-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@acme.com',
        title: 'CTO',
        companyId: 'co-1',
        createdAt: '2024-06-15T00:00:00Z',
        updatedAt: '2024-06-15T00:00:00Z',
      },
    });

    const result = await contactTools.zero_create_contact.handler({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.com',
      title: 'CTO',
      companyId: 'co-1',
    });
    const text = result.content[0].text;

    expect(text).toContain('Contact Created Successfully');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('ct-1');
    expect(text).toContain('jane@acme.com');
    expect(result).not.toHaveProperty('isError');

    // Verify request body
    expect(mockPost).toHaveBeenCalledWith('/api/contacts', expect.objectContaining({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.com',
      companyId: 'co-1',
      workspaceId: WORKSPACE_ID,
    }));
  });
});

// ─── 10. Cross-reference: "Find deals from European companies" ──────────────

describe('cross-reference — deals by company location', () => {
  it('step 1: list companies filtered by country', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-10', name: 'Berlin GmbH', domain: 'berlin.de', city: 'Berlin', country: 'Germany', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'co-11', name: 'Paris SAS', domain: 'paris.fr', city: 'Paris', country: 'France', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const where = { 'location.country': 'Germany' };
    const result = await companyTools.zero_list_companies.handler({ where });
    const text = result.content[0].text;

    expect(text).toContain('Berlin GmbH');
    expect(result).not.toHaveProperty('isError');

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });

  it('step 2: filter deals by companyId $in from matched companies', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-10', name: 'Berlin Deal', value: 50000, stage: 'stage-id-1', company: { id: 'co-10', name: 'Berlin GmbH', country: 'Germany', city: 'Berlin' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'd-11', name: 'Paris Deal', value: 30000, stage: 'stage-id-2', company: { id: 'co-11', name: 'Paris SAS', country: 'France', city: 'Paris' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const where = { companyId: { $in: ['co-10', 'co-11'] } };
    const result = await dealTools.zero_list_deals.handler({ where });
    const text = result.content[0].text;

    expect(text).toContain('Berlin Deal');
    expect(text).toContain('Paris Deal');
    expect(text).toContain('Berlin GmbH');
    expect(text).toContain('Paris SAS');

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });
});

// ─── 11. Deal responses include company location ────────────────────────────

describe('zero_list_deals — company location in output', () => {
  it('shows company city and country in deal listing', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-20', name: 'Local Deal', value: 10000, stage: 'stage-id-1', company: { id: 'co-20', name: 'Tokyo Ltd', country: 'Japan', city: 'Tokyo' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'd-21', name: 'No Location Deal', value: 5000, stage: 'stage-id-2', company: { id: 'co-21', name: 'Mystery Co' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await dealTools.zero_list_deals.handler({});
    const text = result.content[0].text;

    // Company with location shows city, country
    expect(text).toContain('Tokyo Ltd (Tokyo, Japan)');
    // Company without location shows just the name
    expect(text).toContain('Mystery Co');
    expect(text).not.toContain('Mystery Co (');
  });
});

// ─── 12. Get deal shows company location ────────────────────────────────────

describe('zero_get_deal — company location in output', () => {
  it('shows company location in single deal view', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          id: 'd-30',
          name: 'London Deal',
          value: 80000,
          stage: 'stage-id-3',
          confidence: '0.85',
          closeDate: '2026-09-01T00:00:00Z',
          company: { id: 'co-30', name: 'London Corp', country: 'United Kingdom', city: 'London' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
      },
    });

    const result = await dealTools.zero_get_deal.handler({ id: 'd-30' });
    const text = result.content[0].text;

    expect(text).toContain('London Corp');
    expect(text).toContain('London, United Kingdom');
    expect(text).toContain('Closed Won');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 13. Cross-reference: deals by stage + company location ─────────────────

describe('cross-reference — deals by stage and company location', () => {
  it('filters deals by both stage and companyId', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-40', name: 'Qualified EU Deal', value: 60000, stage: 'stage-id-2', company: { id: 'co-10', name: 'Berlin GmbH', country: 'Germany', city: 'Berlin' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const where = { stage: 'stage-id-2', companyId: { $in: ['co-10', 'co-11'] } };
    const result = await dealTools.zero_list_deals.handler({ where });
    const text = result.content[0].text;

    expect(text).toContain('Qualified EU Deal');
    expect(text).toContain('Berlin GmbH (Berlin, Germany)');
    expect(text).toContain('Qualification');

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });
});

// ─── 14. "No results found" ─────────────────────────────────────────────────

describe('zero_list_deals — empty results', () => {
  it('returns "No deals found" message', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
    });

    const result = await dealTools.zero_list_deals.handler({
      where: { value: { $gte: 999999999 } },
    });
    const text = result.content[0].text;

    expect(text).toBe('No deals found matching your criteria.');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 15. "API returns an error" ─────────────────────────────────────────────

describe('zero_list_companies — API error', () => {
  it('returns isError with authentication message on 401', async () => {
    const error = new AxiosError(
      'Unauthorized',
      '401',
      undefined,
      undefined,
      { status: 401, data: { message: 'Unauthorized' } } as any,
    );
    mockGet.mockRejectedValueOnce(error);

    const result = await companyTools.zero_list_companies.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Authentication failed');
    expect(text).toContain('ZERO_API_KEY');
    expect(result).toHaveProperty('isError', true);
  });
});
