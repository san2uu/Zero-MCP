// Zero API Types
// API Version: Beta (as of 2024-01)
// Last updated: 2024-01-15

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
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

export interface Deal {
  id: string;
  workspaceId: string;
  companyId?: string;
  company?: Company;
  contactId?: string;
  contact?: Contact;
  name: string;
  value?: number;
  currency?: string;
  stage?: string;
  probability?: number;
  expectedCloseDate?: string;
  description?: string;
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

export interface ListParams {
  workspaceId?: string;
  fields?: string;
  where?: WhereClause;
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause;
}
