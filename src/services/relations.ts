// Relational query support for Zero CRM entities.
// Maps entity types to their available relations and the dot-notation fields
// needed to fetch related data via the Zero API's `fields` parameter.

type EntityType = 'company' | 'contact' | 'deal' | 'calendarEvent';

const RELATION_FIELDS: Record<EntityType, Record<string, string>> = {
  company: {
    contacts: 'contacts.id,contacts.firstName,contacts.lastName,contacts.email,contacts.title',
    deals: 'deals.id,deals.name,deals.value,deals.stage,deals.closeDate',
    tasks: 'tasks.id,tasks.name,tasks.done,tasks.deadline',
    notes: 'notes.id,notes.content,notes.createdAt',
    emailThreads: 'emailThreads.id,emailThreads.subject,emailThreads.snippet,emailThreads.lastEmailTime',
    calendarEvents: 'calendarEvents.id,calendarEvents.name,calendarEvents.startTime,calendarEvents.endTime',
    activities: 'activities.id,activities.type,activities.name,activities.time',
    issues: 'issues.id,issues.title,issues.status,issues.source,issues.createdAt',
    comments: 'comments.id,comments.content,comments.createdAt',
  },
  contact: {
    company: 'company.id,company.name,company.domain',
    deals: 'deals.id,deals.name,deals.value,deals.stage,deals.closeDate',
    tasks: 'tasks.id,tasks.name,tasks.done,tasks.deadline',
    notes: 'notes.id,notes.content,notes.createdAt',
    emailThreads: 'emailThreads.id,emailThreads.subject,emailThreads.snippet,emailThreads.lastEmailTime',
    calendarEvents: 'calendarEvents.id,calendarEvents.name,calendarEvents.startTime,calendarEvents.endTime',
    activities: 'activities.id,activities.type,activities.name,activities.time',
    issues: 'issues.id,issues.title,issues.status,issues.source,issues.createdAt',
    comments: 'comments.id,comments.content,comments.createdAt',
  },
  deal: {
    company: 'company.id,company.name,company.domain',
    contacts: 'contacts.id,contacts.firstName,contacts.lastName,contacts.email,contacts.title',
    tasks: 'tasks.id,tasks.name,tasks.done,tasks.deadline',
    notes: 'notes.id,notes.content,notes.createdAt',
    emailThreads: 'emailThreads.id,emailThreads.subject,emailThreads.snippet,emailThreads.lastEmailTime',
    calendarEvents: 'calendarEvents.id,calendarEvents.name,calendarEvents.startTime,calendarEvents.endTime',
    activities: 'activities.id,activities.type,activities.name,activities.time',
    issues: 'issues.id,issues.title,issues.status,issues.source,issues.createdAt',
    comments: 'comments.id,comments.content,comments.createdAt',
  },
  calendarEvent: {
    contacts: 'contacts.id,contacts.firstName,contacts.lastName,contacts.email,contacts.title',
    companies: 'companies.id,companies.name,companies.domain',
    tasks: 'tasks.id,tasks.name,tasks.done,tasks.deadline',
  },
};

/**
 * Appends relation fields to an existing fields string based on the `include` array.
 * Invalid include names are silently ignored.
 */
export function buildIncludeFields(entityType: EntityType, include: string[], baseFields?: string): string {
  const relations = RELATION_FIELDS[entityType];
  const extraFields = include
    .filter((name) => name in relations)
    .map((name) => relations[name]);

  if (extraFields.length === 0) return baseFields || '';

  return baseFields ? `${baseFields},${extraFields.join(',')}` : extraFields.join(',');
}

function formatContent(value: unknown): string {
  if (value == null) return 'N/A';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Renders included relations from a record as markdown sections.
 * Returns an empty string if there are no included relations to display.
 */
export function formatIncludedRelations(entityType: EntityType, record: Record<string, unknown>, include: string[]): string {
  const relations = RELATION_FIELDS[entityType];
  const sections: string[] = [];

  for (const name of include) {
    if (!(name in relations)) continue;

    const data = record[name];
    if (data == null) continue;

    // Single relation (e.g., contact.company)
    if (!Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      if (name === 'company') {
        sections.push(`\n### Company\n- **${obj.name || 'N/A'}** (${obj.id || 'N/A'})${obj.domain ? ` — ${obj.domain}` : ''}`);
      } else {
        sections.push(`\n### ${capitalize(name)}\n- **ID:** ${obj.id || 'N/A'}`);
      }
      continue;
    }

    const items = data as Record<string, unknown>[];
    if (items.length === 0) continue;

    const label = capitalize(name);
    let itemLines: string[];

    switch (name) {
      case 'contacts':
        itemLines = items.map((c) => `- ${c.firstName || ''} ${c.lastName || ''} — ${c.email || 'N/A'}${c.title ? ` (${c.title})` : ''}`);
        break;
      case 'companies':
        itemLines = items.map((c) => `- **${c.name || 'N/A'}**${c.domain ? ` (${c.domain})` : ''}`);
        break;
      case 'deals':
        itemLines = items.map((d) => {
          const val = d.value != null ? `$${Number(d.value).toLocaleString()}` : 'N/A';
          return `- ${d.name || 'N/A'} — ${val}`;
        });
        break;
      case 'tasks':
        itemLines = items.map((t) => {
          const check = t.done ? '[x]' : '[ ]';
          const dl = t.deadline ? ` (due ${new Date(t.deadline as string).toLocaleDateString()})` : '';
          return `- ${check} ${t.name || 'N/A'}${dl}`;
        });
        break;
      case 'notes':
        itemLines = items.map((n) => `- ${formatContent(n.content)} — ${n.createdAt ? new Date(n.createdAt as string).toLocaleDateString() : ''}`);
        break;
      case 'emailThreads':
        itemLines = items.map((e) => `- **${e.subject || 'No subject'}** — ${e.snippet || ''}${e.lastEmailTime ? ` (${new Date(e.lastEmailTime as string).toLocaleDateString()})` : ''}`);
        break;
      case 'calendarEvents':
        itemLines = items.map((ev) => {
          const start = ev.startTime ? new Date(ev.startTime as string).toLocaleString() : 'N/A';
          const end = ev.endTime ? new Date(ev.endTime as string).toLocaleString() : '';
          return `- ${ev.name || 'Untitled'} — ${start}${end ? ` to ${end}` : ''}`;
        });
        break;
      case 'activities':
        itemLines = items.map((a) => `- [${a.type || 'unknown'}] ${a.name || 'N/A'}${a.time ? ` (${new Date(a.time as string).toLocaleDateString()})` : ''}`);
        break;
      case 'issues':
        itemLines = items.map((iss) => `- ${iss.title || 'Untitled'} — ${iss.status || 'N/A'}${iss.source ? ` (${iss.source})` : ''}${iss.createdAt ? ` — ${new Date(iss.createdAt as string).toLocaleDateString()}` : ''}`);
        break;
      case 'comments':
        itemLines = items.map((c) => `- ${formatContent(c.content)} — ${c.createdAt ? new Date(c.createdAt as string).toLocaleDateString() : ''}`);
        break;
      default:
        itemLines = items.map((item) => `- ${JSON.stringify(item)}`);
    }

    sections.push(`\n### ${label} (${items.length})\n${itemLines.join('\n')}`);
  }

  return sections.join('\n');
}

function capitalize(s: string): string {
  if (s === 'emailThreads') return 'Email Threads';
  if (s === 'calendarEvents') return 'Calendar Events';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
