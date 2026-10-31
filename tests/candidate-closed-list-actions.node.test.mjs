import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRecruitmentDeadlineOpen } from '../src/lib/recruitmentDeadline.ts';
const listing = readFileSync(new URL('../src/pages/PublicJobsPage.tsx', import.meta.url), 'utf8');
test('CA02-05: list CTA reuses server-compatible expiry rule', () => {
  assert.match(listing, /const applicationsOpen = isRecruitmentDeadlineOpen\(job\.application_deadline\)/);
  assert.match(listing, /disabled=\{publicOnly \|\| !applicationsOpen\}/);
  assert.match(listing, /applicationsOpen \? 'Apply Now' : 'Applications closed'/);
});
test('CA02-05: DATE is inclusive through the full UTC deadline day', () => {
  assert.equal(isRecruitmentDeadlineOpen('2026-10-31', new Date('2026-10-31T23:59:59.999Z')), true);
  assert.equal(isRecruitmentDeadlineOpen('2026-10-31', new Date('2026-11-01T00:00:00.000Z')), false);
});
test('CA02-05: invalid and expired deadlines never allow application', () => {
  assert.equal(isRecruitmentDeadlineOpen('2026-02-30', new Date('2026-02-01T00:00:00.000Z')), false);
  assert.equal(isRecruitmentDeadlineOpen('not-a-date', new Date('2026-10-31T09:00:00.000Z')), false);
  assert.match(listing, /title=\{!applicationsOpen \? t\('Applications are closed for this vacancy\.'\)/);
});
