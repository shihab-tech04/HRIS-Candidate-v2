import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLatestRequestGate } from '../../src/lib/latestRequest.mjs';

const page = await readFile(new URL('../../src/pages/PublicJobsPage.tsx', import.meta.url), 'utf8');

test('vacancy query stays on the submitted search while typing remains unsubmitted', () => {
  assert.match(page, /const \[submittedSearch, setSubmittedSearch\] = useState\(''\)/);
  assert.match(page, /search: submittedSearch/);
  assert.match(page, /setSubmittedSearch\(search\.trim\(\)\)/);
  assert.match(page, /setSubmittedSearch\(''\)/);
});

test('only the newest public vacancy request may update visible results', () => {
  const gate = createLatestRequestGate();
  const older = gate.open();
  const latest = gate.open();
  assert.equal(older.isCurrent(), false);
  assert.equal(latest.isCurrent(), true);
  older.cancel();
  assert.equal(latest.isCurrent(), true);
  latest.cancel();
  assert.equal(latest.isCurrent(), false);
  assert.match(page, /if \(request\.isCurrent\(\)\) setJobs\(data\)/);
});

test('saved-job reads do not refetch or alter public vacancy search state', () => {
  assert.match(page, /\[user\?\.id, publicOnly\]/);
  assert.doesNotMatch(page, /\[user, department, workplaceType, employmentType\]/);
});

test('salary copy does not invent a monthly period and the filter includes existing Internship type', () => {
  assert.doesNotMatch(page, /\/ mo/);
  assert.match(page, /'Part-time', 'Internship'/);
});
