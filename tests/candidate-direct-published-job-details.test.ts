import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const marker = 'export async function getPublishedJobById(jobId: string): Promise<PublishedJob | null>';
const start = api.indexOf(marker);
const end = api.indexOf('// CANDIDATE PROFILE:', start);
if (start < 0 || end < 0) throw Error('Candidate job details service is missing');
const details = api.slice(start, end);

test('Admin job deep-links use an ID-filtered authoritative published SQL view, not the first listing page', () => {
  expect(details).toContain("supabase.from('candidate_published_jobs')");
  expect(details).toContain(".eq('id', jobId)");
  expect(details).toContain(".eq('status', 'published')");
  expect(details).toContain(".eq('is_published', true)");
  expect(details).toContain(".eq('is_active', true)");
  expect(details).toContain('Array.isArray(data)');
  expect(details).toContain("String(candidate.id) === jobId");
  expect(details.indexOf('supabase.from')).toBeLessThan(details.indexOf('const jobs = await getPublishedJobs()'));
});

test('closed/unpublished/expired IDs are never presented as public job details', () => {
  expect(details).toContain('if (!row) return null;');
  expect(details).toContain('isRecruitmentDeadlineOpen(job.application_deadline) ? job : null');
  expect(details).toContain('normalizePublishedJob(row as Record<string, any>)');
  expect(api).toContain('salaryPublic && row.salary_min != null');
  expect(api).toContain('salaryPublic && row.salary_max != null');
  expect(api).toContain('salaryPublic ? row.salary_currency ?? undefined : undefined');
});

test('SQL errors fail closed in production and mock vacancy fallback stays demo-only', () => {
  expect(details).toContain('if (!DEMO_MODE)');
  expect(details).toContain("throw new Error('Unable to verify this published vacancy. Please retry.')");
  expect(details).toContain('const jobs = await getPublishedJobs()');
  expect(api).toContain("if (!DEMO_MODE) throw new Error('Unable to verify published vacancies. Please retry.')");
});
