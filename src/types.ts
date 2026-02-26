// Zero API Types
// API Version: 1.3.0
// Last updated: 2026-02-26

export interface Workspace {
  id: string;
  name: string;
  key?: string;
  domain?: string;
  avatar?: string;
  color?: string;
  settings?: Record<string, unknown>;
  type?: string;
  trialEndsAt?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyLocation {
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  postalCode?: string;
  continent?: string;
  countryCode?: string;
  stateCode?: string;
  coordinates?: { lat: number; lng: number };
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  domain?: string;
  description?: string;
  linkedin?: string;
  logo?: string;
  location?: CompanyLocation;
  listIds?: string[];
  ownerIds?: string[];
  parentCompanyId?: string;
  custom?: Record<string, unknown>;
  externalId?: string;
  source?: string;
  createdById?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  companyId?: string;
  company?: Company;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  linkedin?: string;
  x?: string;
  facebook?: string;
  github?: string;
  avatar?: string;
  location?: CompanyLocation;
  type?: string;
  custom?: Record<string, unknown>;
  listIds?: string[];
  ownerIds?: string[];
  externalId?: string;
  source?: string;
  createdById?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  workspaceId: string;
  name: string;
  position?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  workspaceId: string;
  companyId?: string;
  company?: Company;
  contactIds?: string[];
  name: string;
  value?: number;
  stage?: string;
  pipelineId?: string;
  confidence?: number;
  closeDate?: string;
  startDate?: string;
  endDate?: string;
  ownerIds?: string[];
  listIds?: string[];
  custom?: Record<string, unknown>;
  externalId?: string;
  source?: string;
  createdById?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiListResponse<T> {
  data: T[];
  total?: number;
  limit: number;
  offset: number;
}

export interface WhereClause {
  [field: string]: unknown;
}

export interface OrderByClause {
  [field: string]: 'asc' | 'desc';
}

export interface Task {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | Record<string, unknown>;
  done?: boolean;
  deadline?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  assigneeIds?: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface Note {
  id: string;
  workspaceId: string;
  name?: string;
  emoji?: string;
  content?: string | Record<string, unknown>;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  externalId?: string;
  source?: string;
  createdById?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  type?: string;
  name?: string;
  data?: Record<string, unknown>;
  companyIds?: string[];
  contactIds?: string[];
  time?: string;
  calendarEventId?: string;
  emailThreadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailThread {
  id: string;
  workspaceId: string;
  subject?: string;
  snippet?: string;
  from?: Record<string, unknown>[];
  fromEmails?: string[];
  companyIds?: string[];
  contactIds?: string[];
  dealIds?: string[];
  lastEmailTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  workspaceId: string;
  name?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  userIds?: string[];
  attendees?: Record<string, unknown>[];
  attendeeEmails?: string[];
  companyIds?: string[];
  contactIds?: string[];
  dealIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  workspaceId: string;
  content?: string | Record<string, unknown>;
  authorId?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  workspaceId: string;
  name?: string;
  description?: string | Record<string, unknown>;
  status?: string;
  priority?: number;
  source?: string;
  type?: string;
  companyIds?: string[];
  contactIds?: string[];
  issueNumber?: string;
  previewText?: string;
  link?: string;
  channel?: string;
  labels?: string[];
  time?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface List {
  id: string;
  workspaceId: string;
  name: string;
  entity?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  key?: string;
  type?: string;
  entity?: string;
  options?: Record<string, unknown>[];
  ai?: boolean;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string;
}

export interface ListParams {
  workspaceId?: string;
  fields?: string;
  where?: WhereClause;
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause;
}
