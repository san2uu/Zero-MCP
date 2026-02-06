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
import { taskTools } from '../tools/tasks.js';
import { noteTools } from '../tools/notes.js';
import { activityTools } from '../tools/activities.js';
import { emailThreadTools } from '../tools/email-threads.js';
import { calendarEventTools } from '../tools/calendar-events.js';
import { commentTools } from '../tools/comments.js';
import { issueTools } from '../tools/issues.js';
import { listTools } from '../tools/lists.js';
import { activeDealTools } from '../tools/active-deals.js';
import { setCachedWorkspaceId, setCachedPipelineStages, buildQueryParams } from '../services/api.js';
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
  it('shows company city and country from flat fields', async () => {
    // First call: list deals
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-20', name: 'Local Deal', value: 10000, stage: 'stage-id-1', companyId: 'co-20', company: { id: 'co-20', name: 'Tokyo Ltd' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'd-21', name: 'No Location Deal', value: 5000, stage: 'stage-id-2', companyId: 'co-21', company: { id: 'co-21', name: 'Mystery Co' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });
    // Second call: enrich companies — flat fields (city, country at top level)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-20', name: 'Tokyo Ltd', city: 'Tokyo', country: 'Japan' },
          { id: 'co-21', name: 'Mystery Co' },
        ],
      },
    });

    const result = await dealTools.zero_list_deals.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Tokyo Ltd (Tokyo, Japan)');
    expect(text).toContain('Mystery Co');
    expect(text).not.toContain('Mystery Co (');
  });

  it('shows company city and country from nested location object', async () => {
    // First call: list deals
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-22', name: 'Nested Deal', value: 20000, stage: 'stage-id-1', companyId: 'co-22', company: { id: 'co-22', name: 'Helsinki Oy' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
    // Second call: enrich companies — nested location object
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-22', name: 'Helsinki Oy', location: { city: 'Helsinki', country: 'Finland' } },
        ],
      },
    });

    const result = await dealTools.zero_list_deals.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Helsinki Oy (Helsinki, Finland)');
  });
});

// ─── 12. Get deal shows company location ────────────────────────────────────

describe('zero_get_deal — company location in output', () => {
  it('shows company location in single deal view', async () => {
    // First call: get deal
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          id: 'd-30',
          name: 'London Deal',
          value: 80000,
          stage: 'stage-id-3',
          confidence: '0.85',
          closeDate: '2026-09-01T00:00:00Z',
          companyId: 'co-30',
          company: { id: 'co-30', name: 'London Corp' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
        },
      },
    });
    // Second call: enrich company (fetchCompaniesByIds)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-30', name: 'London Corp', city: 'London', country: 'United Kingdom' },
        ],
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
    // First call: list deals
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-40', name: 'Qualified EU Deal', value: 60000, stage: 'stage-id-2', companyId: 'co-10', company: { id: 'co-10', name: 'Berlin GmbH' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
    // Second call: enrich companies (fetchCompaniesByIds)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-10', name: 'Berlin GmbH', city: 'Berlin', country: 'Germany' },
        ],
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

// ─── 16. Relational queries: include tasks on companies ─────────────────────

describe('zero_list_companies — include tasks', () => {
  it('appends tasks.* fields and renders tasks in output', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'co-1', name: 'Acme Corp', domain: 'acme.com', industry: 'Tech', size: '100',
            city: 'SF', state: 'CA', country: 'US',
            createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
            tasks: [
              { id: 't-1', name: 'Follow up', done: false, deadline: '2026-03-01T00:00:00Z' },
              { id: 't-2', name: 'Send proposal', done: true },
            ],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await companyTools.zero_list_companies.handler({ include: ['tasks'] });
    const text = result.content[0].text;

    // Verify fields param includes tasks.*
    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.fields).toContain('tasks.id');
    expect(callParams.fields).toContain('tasks.name');
    expect(callParams.fields).toContain('tasks.done');
    expect(callParams.fields).toContain('tasks.deadline');

    // Verify tasks are rendered in output
    expect(text).toContain('Tasks (2)');
    expect(text).toContain('[ ] Follow up');
    expect(text).toContain('[x] Send proposal');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 17. Relational queries: include multiple relations on companies ────────

describe('zero_list_companies — include contacts and deals', () => {
  it('appends both contacts.* and deals.* fields', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'co-1', name: 'Acme Corp', domain: 'acme.com',
            createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
            contacts: [
              { id: 'ct-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', title: 'CTO' },
            ],
            deals: [
              { id: 'd-1', name: 'Big Deal', value: 50000, stage: 'stage-id-1', closeDate: '2026-06-01T00:00:00Z' },
            ],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await companyTools.zero_list_companies.handler({ include: ['contacts', 'deals'] });
    const text = result.content[0].text;

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.fields).toContain('contacts.id');
    expect(callParams.fields).toContain('deals.id');

    expect(text).toContain('Contacts (1)');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Deals (1)');
    expect(text).toContain('Big Deal');
  });
});

// ─── 18. Relational queries: get company with include ───────────────────────

describe('zero_get_company — include tasks and notes', () => {
  it('includes tasks and notes in single company view', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 'co-1', name: 'Acme Corp', domain: 'acme.com', industry: 'Tech',
        createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
        tasks: [
          { id: 't-1', name: 'Call client', done: false },
        ],
        notes: [
          { id: 'n-1', content: 'Great meeting today', createdAt: '2024-06-15T00:00:00Z' },
        ],
      },
    });

    const result = await companyTools.zero_get_company.handler({ id: 'co-1', include: ['tasks', 'notes'] });
    const text = result.content[0].text;

    expect(text).toContain('Tasks (1)');
    expect(text).toContain('[ ] Call client');
    expect(text).toContain('Notes (1)');
    expect(text).toContain('Great meeting today');
  });
});

// ─── 19. Relational queries: list contacts with include deals ───────────────

describe('zero_list_contacts — include deals', () => {
  it('includes deals in contact listing', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ct-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com',
            createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
            deals: [
              { id: 'd-1', name: 'Acme Deal', value: 25000 },
            ],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await contactTools.zero_list_contacts.handler({ include: ['deals'] });
    const text = result.content[0].text;

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.fields).toContain('deals.id');
    expect(callParams.fields).toContain('deals.name');

    expect(text).toContain('Deals (1)');
    expect(text).toContain('Acme Deal');
  });
});

// ─── 20. Relational queries: list deals with include ────────────────────────

describe('zero_list_deals — include tasks and contacts', () => {
  it('includes tasks and contacts in deal listing', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'd-1', name: 'Big Deal', value: 50000, stage: 'stage-id-1',
            createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
            tasks: [
              { id: 't-1', name: 'Negotiate terms', done: false },
            ],
            contacts: [
              { id: 'ct-1', firstName: 'John', lastName: 'Smith', email: 'john@corp.com' },
            ],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await dealTools.zero_list_deals.handler({ include: ['tasks', 'contacts'] });
    const text = result.content[0].text;

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.fields).toContain('tasks.id');
    expect(callParams.fields).toContain('contacts.id');

    expect(text).toContain('Tasks (1)');
    expect(text).toContain('Negotiate terms');
    expect(text).toContain('Contacts (1)');
    expect(text).toContain('John Smith');
  });
});

// ─── 21. Include with empty related data ────────────────────────────────────

describe('zero_list_companies — include with empty relations', () => {
  it('gracefully handles empty related data', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'co-1', name: 'Empty Corp', domain: 'empty.com',
            createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
            tasks: [],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await companyTools.zero_list_companies.handler({ include: ['tasks'] });
    const text = result.content[0].text;

    expect(text).toContain('Empty Corp');
    // Empty arrays should not render a section
    expect(text).not.toContain('Tasks (0)');
  });
});

// ─── 22. Invalid include name is silently ignored ───────────────────────────

describe('zero_list_companies — invalid include name', () => {
  it('silently ignores invalid include names', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'co-1', name: 'Test Corp', domain: 'test.com',
            createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await companyTools.zero_list_companies.handler({ include: ['nonexistent'] });
    const text = result.content[0].text;

    expect(text).toContain('Test Corp');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 23. New entity: List tasks ─────────────────────────────────────────────

describe('zero_list_tasks', () => {
  it('lists tasks with checkbox formatting', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 't-1', name: 'Call client', done: false, deadline: '2026-03-01T00:00:00Z', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 't-2', name: 'Send report', done: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await taskTools.zero_list_tasks.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Tasks (2 of 2)');
    expect(text).toContain('[ ] Call client');
    expect(text).toContain('[x] Send report');
    expect(text).toContain('t-1');
    expect(result).not.toHaveProperty('isError');

    expect(mockGet).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
      params: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
    }));
  });

  it('applies where filter', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 't-3', name: 'Pending task', done: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const where = { done: false };
    await taskTools.zero_list_tasks.handler({ where });

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });
});

// ─── 24. New entity: List notes ─────────────────────────────────────────────

describe('zero_list_notes', () => {
  it('lists notes', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'n-1', content: 'Meeting went well', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
          { id: 'n-2', content: { type: 'doc', text: 'Structured note' }, createdAt: '2024-06-16T00:00:00Z', updatedAt: '2024-06-16T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await noteTools.zero_list_notes.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Notes (2 of 2)');
    expect(text).toContain('Meeting went well');
    expect(text).toContain('Structured note');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 25. New entity: List activities ────────────────────────────────────────

describe('zero_list_activities', () => {
  it('lists activities with type and time', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'a-1', type: 'call', name: 'Sales call', time: '2024-06-15T10:00:00Z', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
          { id: 'a-2', type: 'meeting', name: 'Demo presentation', time: '2024-06-16T14:00:00Z', createdAt: '2024-06-16T00:00:00Z', updatedAt: '2024-06-16T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await activityTools.zero_list_activities.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Activities (2 of 2)');
    expect(text).toContain('[call]');
    expect(text).toContain('Sales call');
    expect(text).toContain('[meeting]');
    expect(text).toContain('Demo presentation');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 26. New entity: List email threads ─────────────────────────────────────

describe('zero_list_email_threads', () => {
  it('lists email threads with subject and snippet', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'e-1', subject: 'Partnership proposal', snippet: 'Hi, I wanted to discuss...', fromEmails: ['alice@corp.com'], lastEmailTime: '2024-06-15T10:00:00Z', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await emailThreadTools.zero_list_email_threads.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Email Threads (1 of 1)');
    expect(text).toContain('Partnership proposal');
    expect(text).toContain('Hi, I wanted to discuss...');
    expect(text).toContain('alice@corp.com');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 27. New entity: List calendar events ───────────────────────────────────

describe('zero_list_calendar_events', () => {
  it('lists calendar events with date/time', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ev-1', name: 'Team standup', startTime: '2024-06-15T09:00:00Z', endTime: '2024-06-15T09:30:00Z', location: 'Zoom', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await calendarEventTools.zero_list_calendar_events.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Calendar Events (1 of 1)');
    expect(text).toContain('Team standup');
    expect(text).toContain('Zoom');
    expect(result).not.toHaveProperty('isError');

    // Default excludeNullDates injects startTime filter
    const callParams = mockGet.mock.calls[0][1].params;
    const where = JSON.parse(callParams.where);
    expect(where.startTime).toEqual({ $gte: '2000-01-01' });
  });

  it('does not inject startTime filter when excludeNullDates is false', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
    });

    await calendarEventTools.zero_list_calendar_events.handler({ excludeNullDates: false });

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBeUndefined();
  });

  it('does not override explicit startTime filter', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
    });

    const where = { startTime: { $gte: '2026-01-01' } };
    await calendarEventTools.zero_list_calendar_events.handler({ where });

    const callParams = mockGet.mock.calls[0][1].params;
    const parsedWhere = JSON.parse(callParams.where);
    expect(parsedWhere.startTime).toEqual({ $gte: '2026-01-01' });
  });
});

// ─── 28. New entity: List comments ──────────────────────────────────────────

describe('zero_list_comments', () => {
  it('lists comments with content', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'cm-1', content: 'Looks good!', authorId: 'user-1', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
          { id: 'cm-2', content: { type: 'rich', text: 'Nice work' }, authorId: 'user-2', createdAt: '2024-06-16T00:00:00Z', updatedAt: '2024-06-16T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await commentTools.zero_list_comments.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Comments (2 of 2)');
    expect(text).toContain('Looks good!');
    expect(text).toContain('Nice work');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 29. New entity: List lists ─────────────────────────────────────────────

describe('zero_list_lists', () => {
  it('lists with entity and color', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'l-1', name: 'Hot Leads', entity: 'company', color: 'red', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
          { id: 'l-2', name: 'Q1 Deals', entity: 'deal', color: 'blue', createdAt: '2024-06-16T00:00:00Z', updatedAt: '2024-06-16T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await listTools.zero_list_lists.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Lists (2 of 2)');
    expect(text).toContain('Hot Leads');
    expect(text).toContain('company');
    expect(text).toContain('red');
    expect(text).toContain('Q1 Deals');
    expect(text).toContain('deal');
    expect(text).toContain('blue');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 30. Create task ────────────────────────────────────────────────────────

describe('zero_create_task', () => {
  it('creates a task and returns success', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: 't-new',
        name: 'Review contract',
        done: false,
        deadline: '2026-04-01T00:00:00Z',
        createdAt: '2024-06-15T00:00:00Z',
        updatedAt: '2024-06-15T00:00:00Z',
      },
    });

    const result = await taskTools.zero_create_task.handler({
      name: 'Review contract',
      deadline: '2026-04-01T00:00:00Z',
      companyId: 'co-1',
    });
    const text = result.content[0].text;

    expect(text).toContain('Task Created Successfully');
    expect(text).toContain('Review contract');
    expect(text).toContain('t-new');
    expect(result).not.toHaveProperty('isError');

    expect(mockPost).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
      name: 'Review contract',
      deadline: '2026-04-01T00:00:00Z',
      companyId: 'co-1',
      workspaceId: WORKSPACE_ID,
    }));
  });
});

// ─── 31. Create note ────────────────────────────────────────────────────────

describe('zero_create_note', () => {
  it('creates a note and returns success', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: 'n-new',
        content: 'Important findings from the call',
        createdAt: '2024-06-15T00:00:00Z',
        updatedAt: '2024-06-15T00:00:00Z',
      },
    });

    const result = await noteTools.zero_create_note.handler({
      content: 'Important findings from the call',
      dealId: 'd-1',
    });
    const text = result.content[0].text;

    expect(text).toContain('Note Created Successfully');
    expect(text).toContain('n-new');
    expect(result).not.toHaveProperty('isError');

    expect(mockPost).toHaveBeenCalledWith('/api/notes', expect.objectContaining({
      content: 'Important findings from the call',
      dealId: 'd-1',
      workspaceId: WORKSPACE_ID,
    }));
  });
});

// ─── 32. New entity: List issues (Slack messages) ────────────────────────────

describe('zero_list_issues', () => {
  it('lists issues with entity associations', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'iss-1', name: 'Customer request', status: 'open', source: 'slack', description: 'Need pricing info', companyIds: ['co-1'], channel: '#support', createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
          { id: 'iss-2', name: 'Bug report', status: 'closed', source: 'slack', description: 'Login issue', contactIds: ['ct-1'], createdAt: '2024-06-16T00:00:00Z', updatedAt: '2024-06-16T00:00:00Z' },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await issueTools.zero_list_issues.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Issues (2 of 2)');
    expect(text).toContain('Customer request');
    expect(text).toContain('Bug report');
    expect(text).toContain('open');
    expect(text).toContain('slack');
    expect(text).toContain('Company IDs:');
    expect(text).toContain('co-1');
    expect(text).toContain('Contact IDs:');
    expect(text).toContain('ct-1');
    expect(text).toContain('#support');
    expect(result).not.toHaveProperty('isError');
  });

  it('filters by date', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'iss-3', name: 'Recent message', status: 'open', createdAt: '2026-02-04T00:00:00Z', updatedAt: '2026-02-04T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const where = { createdAt: { $gte: '2026-02-03' } };
    await issueTools.zero_list_issues.handler({ where });

    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify(where));
  });
});

// ─── 33. Get issue ───────────────────────────────────────────────────────────

describe('zero_get_issue', () => {
  it('returns issue with full details and associations', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          id: 'iss-1',
          name: 'Customer request',
          status: 'open',
          priority: 2,
          source: 'slack',
          description: 'Need pricing info',
          companyIds: ['co-1'],
          contactIds: ['ct-1'],
          channel: '#support',
          link: 'https://slack.com/msg/123',
          createdAt: '2024-06-15T00:00:00Z',
          updatedAt: '2024-06-15T00:00:00Z',
        },
      },
    });

    const result = await issueTools.zero_get_issue.handler({ id: 'iss-1' });
    const text = result.content[0].text;

    expect(text).toContain('Customer request');
    expect(text).toContain('open');
    expect(text).toContain('2');
    expect(text).toContain('slack');
    expect(text).toContain('Company IDs:');
    expect(text).toContain('Contact IDs:');
    expect(text).toContain('#support');
    expect(text).toContain('https://slack.com/msg/123');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 34. Activities show entity association IDs ──────────────────────────────

describe('zero_list_activities — entity associations', () => {
  it('shows companyIds, contactIds in output', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'a-1', type: 'call', name: 'Sales call', time: '2024-06-15T10:00:00Z', companyIds: ['co-1'], contactIds: ['ct-1'], createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await activityTools.zero_list_activities.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Company IDs:');
    expect(text).toContain('co-1');
    expect(text).toContain('Contact IDs:');
    expect(text).toContain('ct-1');
  });
});

// ─── 35. Email threads show entity association IDs ───────────────────────────

describe('zero_list_email_threads — entity associations', () => {
  it('shows dealIds, companyIds in output', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'e-1', subject: 'Follow up', snippet: 'Hi...', fromEmails: ['a@b.com'], lastEmailTime: '2024-06-15T10:00:00Z', dealIds: ['d-5'], companyIds: ['co-5'], createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await emailThreadTools.zero_list_email_threads.handler({});
    const text = result.content[0].text;

    expect(text).toContain('Deal IDs:');
    expect(text).toContain('d-5');
    expect(text).toContain('Company IDs:');
    expect(text).toContain('co-5');
  });
});

// ─── 36. Calendar events show entity association IDs ─────────────────────────

describe('zero_list_calendar_events — entity associations', () => {
  it('shows dealIds, companyIds in output', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ev-1', name: 'Call', startTime: '2024-06-15T09:00:00Z', endTime: '2024-06-15T09:30:00Z', location: 'Zoom', dealIds: ['d-7'], companyIds: ['co-7'], userIds: ['u-1'], createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z' },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await calendarEventTools.zero_list_calendar_events.handler({ where: { startTime: { $gte: '2024-01-01' } } });
    const text = result.content[0].text;

    expect(text).toContain('Deal IDs:');
    expect(text).toContain('d-7');
    expect(text).toContain('Company IDs:');
    expect(text).toContain('co-7');
    expect(text).toContain('User IDs:');
    expect(text).toContain('u-1');
  });
});

// ─── 37. Composite: Find active deals ────────────────────────────────────────

describe('zero_find_active_deals', () => {
  it('queries all sources and returns deals with activity summary via company association', async () => {
    // Call 1: activities — linked to companies (resolved to deals via companyId)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'a-1', companyIds: ['co-1'], time: '2026-02-04T10:00:00Z' },
          { id: 'a-2', companyIds: ['co-2'], time: '2026-02-05T10:00:00Z' },
        ],
        total: 2,
      },
    });
    // Call 2: emailThreads — linked to companies
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'e-1', companyIds: ['co-1'], lastEmailTime: '2026-02-05T14:00:00Z' },
          { id: 'e-2', companyIds: ['co-2'], lastEmailTime: '2026-02-04T12:00:00Z' },
        ],
        total: 2,
      },
    });
    // Call 3: calendarEvents — linked to companies
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ev-1', companyIds: ['co-1'], startTime: '2026-02-06T09:00:00Z' },
        ],
        total: 1,
      },
    });
    // Call 4: issues — linked to companies
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'iss-1', companyIds: ['co-2'], createdAt: '2026-02-04T16:00:00Z' },
        ],
        total: 1,
      },
    });
    // Call 5: fetch deals (by companyId $in)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-1', name: 'Acme Deal', value: 50000, stage: 'stage-id-1', companyId: 'co-1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
          { id: 'd-2', name: 'Globex Deal', value: 30000, stage: 'stage-id-2', companyId: 'co-2', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
      },
    });
    // Call 6: enrich companies (fetchCompaniesByIds)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-1', name: 'Acme Corp', city: 'SF', country: 'US' },
          { id: 'co-2', name: 'Globex Inc', city: 'NYC', country: 'US' },
        ],
      },
    });

    const result = await activeDealTools.zero_find_active_deals.handler({
      since: '2026-02-03',
    });
    const text = result.content[0].text;

    expect(text).toContain('Active Deals');
    expect(text).toContain('2 deals');
    expect(text).toContain('Acme Deal');
    expect(text).toContain('Globex Deal');
    // Acme Deal (co-1): 1 activity + 1 email + 1 meeting
    expect(text).toContain('1 activity');
    expect(text).toContain('1 email');
    expect(text).toContain('1 meeting');
    // Globex Deal (co-2): 1 activity + 1 email + 1 Slack message
    expect(text).toContain('1 Slack message');
    expect(text).toContain('Acme Corp (SF, US)');
    expect(text).toContain('Globex Inc (NYC, US)');
    expect(result).not.toHaveProperty('isError');
  });

  it('returns empty message when no activity found', async () => {
    // All 4 sources return empty
    mockGet.mockResolvedValueOnce({ data: { data: [], total: 0 } });
    mockGet.mockResolvedValueOnce({ data: { data: [], total: 0 } });
    mockGet.mockResolvedValueOnce({ data: { data: [], total: 0 } });
    mockGet.mockResolvedValueOnce({ data: { data: [], total: 0 } });

    const result = await activeDealTools.zero_find_active_deals.handler({
      since: '2026-02-03',
    });
    const text = result.content[0].text;

    expect(text).toContain('No deals found with activity since 2026-02-03');
    expect(text).toContain('Sources checked');
  });

  it('handles source failures gracefully', async () => {
    // activities succeeds with company link
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'a-1', companyIds: ['co-1'], time: '2026-02-04T10:00:00Z' },
        ],
        total: 1,
      },
    });
    // emailThreads succeeds with company link
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'e-1', companyIds: ['co-1'], lastEmailTime: '2026-02-04T14:00:00Z' },
        ],
        total: 1,
      },
    });
    // calendarEvents fails
    mockGet.mockRejectedValueOnce(new Error('API error'));
    // issues fails
    mockGet.mockRejectedValueOnce(new Error('API error'));
    // fetch deals (by companyId $in)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd-1', name: 'Resilient Deal', value: 10000, stage: 'stage-id-1', companyId: 'co-1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
      },
    });
    // enrich companies
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-1', name: 'Acme Corp' },
        ],
      },
    });

    const result = await activeDealTools.zero_find_active_deals.handler({
      since: '2026-02-03',
    });
    const text = result.content[0].text;

    expect(text).toContain('Resilient Deal');
    expect(text).toContain('1 activity');
    expect(text).toContain('1 email');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 38. Resolve contacts by IDs ──────────────────────────────────────────────

describe('zero_resolve_contacts', () => {
  it('resolves multiple contacts by ID array', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ct-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', title: 'CTO', company: { id: 'co-1', name: 'Acme Corp' }, createdAt: '2024-01-01T00:00:00Z' },
          { id: 'ct-2', firstName: 'John', lastName: 'Smith', email: 'john@globex.com', title: 'VP', company: { id: 'co-2', name: 'Globex Inc' }, createdAt: '2024-01-01T00:00:00Z' },
        ],
        total: 2,
      },
    });

    const result = await contactTools.zero_resolve_contacts.handler({
      ids: ['ct-1', 'ct-2', 'ct-unknown'],
    });
    const text = result.content[0].text;

    expect(text).toContain('Resolved Contacts (2 of 3 IDs)');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('John Smith');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Unresolved IDs (1)');
    expect(text).toContain('ct-unknown');
    expect(result).not.toHaveProperty('isError');

    // Verify $in filter was sent
    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.where).toBe(JSON.stringify({ id: { $in: ['ct-1', 'ct-2', 'ct-unknown'] } }));
  });

  it('handles all IDs resolved', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ct-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', createdAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
      },
    });

    const result = await contactTools.zero_resolve_contacts.handler({ ids: ['ct-1'] });
    const text = result.content[0].text;

    expect(text).toContain('Resolved Contacts (1 of 1 IDs)');
    expect(text).not.toContain('Unresolved');
  });

  it('handles no contacts found', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [], total: 0 },
    });

    const result = await contactTools.zero_resolve_contacts.handler({ ids: ['ct-unknown'] });
    const text = result.content[0].text;

    expect(text).toContain('No contacts found');
  });

  it('deduplicates input IDs', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ct-1', firstName: 'Jane', lastName: 'Doe', createdAt: '2024-01-01T00:00:00Z' },
        ],
        total: 1,
      },
    });

    await contactTools.zero_resolve_contacts.handler({ ids: ['ct-1', 'ct-1', 'ct-1'] });

    const callParams = mockGet.mock.calls[0][1].params;
    // Should deduplicate to single ID
    expect(callParams.where).toBe(JSON.stringify({ id: { $in: ['ct-1'] } }));
    expect(callParams.limit).toBe('1');
  });
});

// ─── 39. Calendar events with include contacts (fallback) ─────────────────────

describe('zero_list_calendar_events — include contacts (fallback)', () => {
  it('resolves contacts manually when excludeNullDates adds where clause', async () => {
    // With excludeNullDates default, a where clause is added, triggering fallback.
    // Call 1: fetch events (no relation fields in request)
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ev-1', name: 'Sales call', startTime: '2024-06-15T09:00:00Z', endTime: '2024-06-15T09:30:00Z',
            location: 'Zoom', contactIds: ['ct-1'], companyIds: ['co-1'],
            createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
    // Call 2: resolve contacts by ID
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ct-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', title: 'CTO' },
        ],
      },
    });

    const result = await calendarEventTools.zero_list_calendar_events.handler({ include: ['contacts'] });
    const text = result.content[0].text;

    // First call should NOT have contacts.* in fields (fallback mode)
    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.fields).toBeUndefined();

    // Second call should be contacts bulk fetch
    expect(mockGet.mock.calls[1][0]).toBe('/api/contacts');
    const contactParams = mockGet.mock.calls[1][1].params;
    expect(contactParams.where).toBe(JSON.stringify({ id: { $in: ['ct-1'] } }));

    // Verify contacts are rendered
    expect(text).toContain('Contacts (1)');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@acme.com');
    expect(result).not.toHaveProperty('isError');
  });

  it('resolves contacts and companies in parallel with explicit where', async () => {
    // Call 1: fetch events
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ev-1', name: 'Client meeting', startTime: '2026-02-05T14:00:00Z',
            contactIds: ['ct-1', 'ct-2'], companyIds: ['co-1'],
            createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
        total: 1,
      },
    });
    // Call 2: resolve contacts
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'ct-1', firstName: 'Alice', lastName: 'B', email: 'alice@co.com', title: 'CEO' },
          { id: 'ct-2', firstName: 'Bob', lastName: 'C', email: 'bob@co.com', title: 'CTO' },
        ],
      },
    });
    // Call 3: resolve companies
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'co-1', name: 'Acme Corp', domain: 'acme.com' },
        ],
      },
    });

    const result = await calendarEventTools.zero_list_calendar_events.handler({
      include: ['contacts', 'companies'],
      where: { startTime: { $between: ['2026-02-02', '2026-02-08'] } },
    });
    const text = result.content[0].text;

    expect(text).toContain('Contacts (2)');
    expect(text).toContain('Alice B');
    expect(text).toContain('Bob C');
    expect(text).toContain('Companies (1)');
    expect(text).toContain('Acme Corp');
    expect(result).not.toHaveProperty('isError');
  });

  it('uses direct API include when no where or orderBy (excludeNullDates false)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ev-1', name: 'Team sync', startTime: '2024-06-15T09:00:00Z',
            contactIds: ['ct-1'], companyIds: [],
            createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z',
            contacts: [
              { id: 'ct-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', title: 'CTO' },
            ],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });

    const result = await calendarEventTools.zero_list_calendar_events.handler({
      include: ['contacts'],
      excludeNullDates: false,
    });
    const text = result.content[0].text;

    // Should use direct API include (single call with relation fields)
    expect(mockGet).toHaveBeenCalledTimes(1);
    const callParams = mockGet.mock.calls[0][1].params;
    expect(callParams.fields).toContain('contacts.id');
    expect(callParams.fields).toContain('contacts.firstName');
    expect(text).toContain('Contacts (1)');
    expect(text).toContain('Jane Doe');
  });

  it('handles fallback gracefully when contact resolution fails', async () => {
    // Call 1: fetch events
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ev-1', name: 'Resilient event', startTime: '2024-06-15T09:00:00Z',
            contactIds: ['ct-1'], companyIds: [],
            createdAt: '2024-06-15T00:00:00Z', updatedAt: '2024-06-15T00:00:00Z',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      },
    });
    // Call 2: contact resolution fails
    mockGet.mockRejectedValueOnce(new Error('API error'));

    const result = await calendarEventTools.zero_list_calendar_events.handler({ include: ['contacts'] });
    const text = result.content[0].text;

    // Event should still be returned even though contact resolution failed
    expect(text).toContain('Resilient event');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 40. $gte+$lte auto-transforms to $between ──────────────────────────────

describe('buildQueryParams — $between auto-transform', () => {
  it('transforms $gte+$lte into $between', () => {
    const params = buildQueryParams({
      workspaceId: WORKSPACE_ID,
      where: { startTime: { $gte: '2026-02-02', $lte: '2026-02-08' } },
    });
    const where = JSON.parse(params.where);
    expect(where.startTime).toEqual({ $between: ['2026-02-02', '2026-02-08'] });
  });

  it('transforms $gte+$lt into $between', () => {
    const params = buildQueryParams({
      workspaceId: WORKSPACE_ID,
      where: { time: { $gte: '2026-02-03', $lt: '2026-02-10' } },
    });
    const where = JSON.parse(params.where);
    expect(where.time).toEqual({ $between: ['2026-02-03', '2026-02-10'] });
  });

  it('preserves single $gte without $lte', () => {
    const params = buildQueryParams({
      workspaceId: WORKSPACE_ID,
      where: { createdAt: { $gte: '2026-01-01' } },
    });
    const where = JSON.parse(params.where);
    expect(where.createdAt).toEqual({ $gte: '2026-01-01' });
  });

  it('preserves non-object conditions', () => {
    const params = buildQueryParams({
      workspaceId: WORKSPACE_ID,
      where: { status: 'open', name: { $contains: 'test' } },
    });
    const where = JSON.parse(params.where);
    expect(where.status).toBe('open');
    expect(where.name).toEqual({ $contains: 'test' });
  });
});

// ─── 41. Get contact with response unwrapping ────────────────────────────────

describe('zero_get_contact — response unwrapping', () => {
  it('handles wrapped response { data: contact }', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          id: 'ct-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com',
          title: 'CTO', linkedin: 'https://linkedin.com/in/janedoe',
          company: { id: 'co-1', name: 'Acme Corp' },
          createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z',
        },
      },
    });

    const result = await contactTools.zero_get_contact.handler({ id: 'ct-1' });
    const text = result.content[0].text;

    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@acme.com');
    expect(text).toContain('linkedin.com/in/janedoe');
    expect(text).toContain('Acme Corp');
    expect(result).not.toHaveProperty('isError');
  });

  it('handles unwrapped response (contact directly)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 'ct-2', firstName: 'John', lastName: 'Smith', email: 'john@corp.com',
        createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z',
      },
    });

    const result = await contactTools.zero_get_contact.handler({ id: 'ct-2' });
    const text = result.content[0].text;

    expect(text).toContain('John Smith');
    expect(text).toContain('john@corp.com');
    expect(result).not.toHaveProperty('isError');
  });
});

// ─── 42. Calendar event deduplication ─────────────────────────────────────────

describe('zero_list_calendar_events — deduplication', () => {
  it('merges duplicate events with same name+startTime and unions array fields', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ev-1', name: 'Weekly Sync', startTime: '2026-02-05T14:00:00Z', endTime: '2026-02-05T14:30:00Z',
            location: 'Zoom', contactIds: ['ct-1'], companyIds: ['co-1'], dealIds: ['d-1'], userIds: ['u-1'], attendeeEmails: ['a@test.com'],
            createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
          },
          {
            id: 'ev-2', name: 'Weekly Sync', startTime: '2026-02-05T14:00:00Z', endTime: '2026-02-05T14:30:00Z',
            location: 'Zoom', contactIds: ['ct-2'], companyIds: ['co-2'], dealIds: ['d-2'], userIds: ['u-2'], attendeeEmails: ['b@test.com'],
            createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
          },
          {
            id: 'ev-3', name: 'Different Meeting', startTime: '2026-02-06T10:00:00Z', endTime: '2026-02-06T10:30:00Z',
            location: 'Office', contactIds: ['ct-3'], companyIds: [], dealIds: [], userIds: ['u-1'], attendeeEmails: [],
            createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
        total: 3,
        limit: 20,
        offset: 0,
      },
    });

    const result = await calendarEventTools.zero_list_calendar_events.handler({
      where: { startTime: { $gte: '2026-02-01' } },
    });
    const text = result.content[0].text;

    // Should show 2 unique, 1 duplicate removed
    expect(text).toContain('2 unique');
    expect(text).toContain('1 duplicates removed');
    // Should have merged contact/company/deal IDs
    expect(text).toContain('ct-1');
    expect(text).toContain('ct-2');
    expect(text).toContain('co-1');
    expect(text).toContain('co-2');
    // Different meeting should still be present
    expect(text).toContain('Different Meeting');
    expect(result).not.toHaveProperty('isError');
  });

  it('skips dedup when deduplicate=false', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'ev-1', name: 'Same Meeting', startTime: '2026-02-05T14:00:00Z',
            contactIds: ['ct-1'], companyIds: [], dealIds: [], userIds: [],
            createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
          },
          {
            id: 'ev-2', name: 'Same Meeting', startTime: '2026-02-05T14:00:00Z',
            contactIds: ['ct-2'], companyIds: [], dealIds: [], userIds: [],
            createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
          },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      },
    });

    const result = await calendarEventTools.zero_list_calendar_events.handler({
      where: { startTime: { $gte: '2026-02-01' } },
      deduplicate: false,
    });
    const text = result.content[0].text;

    // Should show both events without dedup
    expect(text).toContain('Calendar Events (2');
    expect(text).not.toContain('unique');
    expect(text).not.toContain('duplicates removed');
  });
});

