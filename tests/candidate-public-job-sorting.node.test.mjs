import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sortPublishedJobs } from '../src/lib/jobSort.mjs';
const jobs = [
  { id: 'old', title: 'Zebra Engineer', published_at: '2026-01-10', application_deadline: '2026-12-20' },
  { id: 'new', title: 'analyst', published_at: '2026-10-20', application_deadline: '2026-11-15' },
  { id: 'mid', title: 'Product Designer', published_at: '2026-08-15', application_deadline: '2026-11-30' },
];
test('CA02-04: default order is preserved and input is unchanged', () => {
  const frozen = Object.freeze(jobs.slice());
  const result = sortPublishedJobs(frozen);
  assert.deepEqual(result.map(j => j.id), ['old', 'new', 'mid']);
  assert.notStrictEqual(result, frozen);
  assert.deepEqual(sortPublishedJobs(frozen, 'other').map(j => j.id), ['old', 'new', 'mid']);
});
test('CA02-04: newest published first, with stable equal timestamps', () => {
  assert.deepEqual(sortPublishedJobs(jobs, 'newest').map(j => j.id), ['new', 'mid', 'old']);
  assert.deepEqual(sortPublishedJobs([{ id: 'a', published_at: '2026-10-01' }, { id: 'b', published_at: '2026-10-01' }], 'newest').map(j => j.id), ['a', 'b']);
});
test('CA02-04: closest published deadline first; invalid dates last', () => {
  assert.deepEqual(sortPublishedJobs([{ id: 'bad', application_deadline: '?' }, ...jobs, { id: 'missing' }], 'deadline').map(j => j.id), ['new', 'mid', 'old', 'bad', 'missing']);
});
test('CA02-04: title A-Z compares case-insensitively', () => {
  assert.deepEqual(sortPublishedJobs(jobs, 'title').map(j => j.id), ['new', 'mid', 'old']);
});
