import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { candidateRouteHref, parseCandidateRoute } from '../src/lib/candidateRoutes.ts';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('job details and application routes restore the selected vacancy', () => {
  assert.deepEqual(parseCandidateRoute('?view=job-details&job=job-104'), {
    tab: 'job-details', jobId: 'job-104',
  });
  assert.deepEqual(parseCandidateRoute('?view=apply&job=job-104'), {
    tab: 'apply', jobId: 'job-104',
  });
});

test('application details restore the selected application', () => {
  assert.deepEqual(parseCandidateRoute('?view=applications&application=app-72'), {
    tab: 'applications', applicationId: 'app-72',
  });
});

test('invalid and incomplete routes recover to the vacancy list', () => {
  assert.deepEqual(parseCandidateRoute('?view=unknown'), { tab: 'jobs' });
  assert.deepEqual(parseCandidateRoute('?view=apply'), { tab: 'jobs' });
  assert.deepEqual(parseCandidateRoute('?job=job-104'), {
    tab: 'job-details', jobId: 'job-104',
  });
});

test('navigation preserves unrelated query parameters and the page fragment', () => {
  assert.equal(candidateRouteHref({
    pathname: '/HRIS-Candidate-v2/',
    search: '?campaign=careers&view=job-details&job=old&application=old',
    hash: '#overview',
  }, { tab: 'apply', jobId: 'job/104' }),
  '/HRIS-Candidate-v2/?campaign=careers&view=apply&job=job%2F104#overview');
});

test('Candidate navigation restores the current URL and browser history state', () => {
  assert.match(app, /parseCandidateRoute\(window\.location\.search\)/);
  assert.match(app, /addEventListener\('popstate'/);
  assert.match(app, /candidateRouteHref\(window\.location, nextRoute\)/);
  assert.match(app, /window\.history\.pushState\(null, '', href\)/);
});

test('a direct application link waits for Auth restoration before opening sign-in', () => {
  assert.match(app, /if \(authLoading \|\| currentTab !== 'apply' \|\| user\) return/);
  assert.match(app, /setAuthModalOpen\(true\)/);
});
