import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { candidateRouteHref, parseCandidateRoute } from '../src/lib/candidateRoutes.ts';
import { candidateNotificationRoute } from '../src/lib/candidateNotificationRoutes.ts';

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

test('candidate application notifications open the linked owner-scoped application timeline', () => {
  assert.deepEqual(candidateNotificationRoute({
    notification_type: 'application_update',
    related_application_id: 'application-27',
    related_job_id: 'job-9',
  }), { tab: 'applications', applicationId: 'application-27' });
  assert.deepEqual(candidateNotificationRoute({
    notification_type: 'job_alert_match',
    related_job_id: 'job-9',
    action_view: 'https://example.test',
  }), { tab: 'saved-jobs' });
  assert.equal(candidateNotificationRoute({
    notification_type: 'system',
    related_application_id: 'application-27',
  }), null);
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

test('public-only production root never mounts the candidate authentication provider', () => {
  const root = app.slice(app.indexOf('export default function App()'));
  assert.ok(root.startsWith('export default function App() {'));
  assert.match(root, /if \(import\.meta\.env\.PROD && import\.meta\.env\.VITE_CANDIDATE_PUBLIC_ONLY === 'true'\)/);
  const publicBranch = root.slice(0, root.indexOf('\n  return (\n    <CandidateLocaleProvider>\n      <AuthProvider>'));
  assert.match(publicBranch, /<CandidateLocaleProvider>[\s\S]*?<PublicOnlyAuthProvider>[\s\S]*?<PublicOnlyCareers \/>[\s\S]*?<\/PublicOnlyAuthProvider>[\s\S]*?<\/CandidateLocaleProvider>/);
  assert.doesNotMatch(publicBranch, /<AuthProvider>|<MainAppContent \/>/);
  assert.match(root, /<AuthProvider>\s*<MainAppContent \/>\s*<\/AuthProvider>/);
});

test('public-only guest context satisfies vacancy components without initializing any Auth or profile session', () => {
  const source = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
  const publicGuest = source.slice(source.indexOf('export const PublicOnlyAuthProvider:'), source.indexOf('export const useAuth ='));
  assert.match(publicGuest, /<AuthContext\.Provider value=\{\{/);
  assert.match(publicGuest, /user: null/);
  assert.match(publicGuest, /profile: null/);
  assert.match(publicGuest, /signIn: unavailableInPublicOnly/);
  assert.doesNotMatch(publicGuest, /getSupabaseClient\(|loadProfile\(|localStorage|fetch\(/);
});
