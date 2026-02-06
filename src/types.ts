// Zero API Types
// API Version: Beta (as of 2024-01)
// Last updated: 2024-01-15

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyLocation {
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  postalCode?: string;
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  description?: string;
  website?: string;
  linkedinUrl?: string;
  // Location may be returned as flat fields or nested under `location`
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  location?: CompanyLocation;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  companyId?: string;
  company?: Company;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  linkedinUrl?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
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
  confidence?: string;
  closeDate?: string;
  startDate?: string;
  endDate?: string;
  ownerIds?: string[];
  archived?: boolean;
  custom?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
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
  content?: string | Record<string, unknown>;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
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
  title?: string;
  description?: string | Record<string, unknown>;
  status?: string;
  priority?: string;
  source?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  assigneeIds?: string[];
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

export interface ListParams {
  workspaceId?: string;
  fields?: string;
  where?: WhereClause;
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause;
}
