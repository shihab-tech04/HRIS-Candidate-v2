import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../src/pages/VerifiedJobDetails.tsx', import.meta.url), 'utf8');
const bn = readFileSync(new URL('../src/lib/candidateLocale.ts', import.meta.url), 'utf8');

test('CA03-06: verified vacancy detail reuses the existing server-parity deadline helper', () => {
  assert.match(page, /isRecruitmentDeadlineOpen\(job\.application_deadline\)/);
  assert.match(page, /disabled=\{publicOnly \|\| !applicationsOpen\}/);
});

test('CA03-07: closed vacancy has a visible, accessible message in EN/BN', () => {
  assert.match(page, /role="status".*className="rounded-lg border border-amber-200/);
  assert.match(page, /candidate-job-closed-notice/);
  assert.match(page, /t\('Applications are closed for this vacancy\.'\)/);
  assert.match(bn, /'Applications closed': 'আবেদন বন্ধ'/);
  assert.match(bn, /'Applications are closed for this vacancy\.':/);
});

test('CA03-07: public-only account and application guards remain unchanged', () => {
  assert.match(page, /disabled=\{publicOnly \|\| busy \|\| loading\}/);
  assert.match(page, /publicOnly \? 'candidate-public-safety-notice'/);
});
