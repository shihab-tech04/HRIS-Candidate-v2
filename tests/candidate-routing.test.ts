import { expect, test } from 'bun:test';
import { candidateRouteUrl, parseCandidateRoute } from '../src/lib/candidateRouting';

test('shared vacancy permalinks restore the original job on refresh', () => {
  expect(parseCandidateRoute('?job=job-synesis-001')).toEqual({tab:'job-details',jobId:'job-synesis-001',applicationId:undefined});
  expect(parseCandidateRoute('?view=apply&job=job-synesis-001').tab).toBe('apply');
  expect(parseCandidateRoute('?view=apply').tab).toBe('jobs');
});

test('application status links preserve their selected application', () => {
  const href=candidateRouteUrl('https://example.test/HRIS-Candidate-v2/?lang=bn', {tab:'applications',applicationId:'app-001'});
  expect(href).toBe('/HRIS-Candidate-v2/?lang=bn&view=applications&application=app-001');
  expect(parseCandidateRoute(new URL(href,'https://example.test').search).applicationId).toBe('app-001');
});

test('back to jobs clears stale candidate context while preserving other query and hash state', () => {
  const href=candidateRouteUrl('https://example.test/HRIS-Candidate-v2/?view=apply&job=job-1&lang=en#section', {tab:'jobs'});
  expect(href).toBe('/HRIS-Candidate-v2/?lang=en#section');
  expect(parseCandidateRoute(new URL(href,'https://example.test').search).tab).toBe('jobs');
});

test('unknown routes and suspicious identifiers cannot open unauthorized destinations', () => {
  expect(parseCandidateRoute('?view=privileged-admin')).toEqual({tab:'jobs',jobId:undefined,applicationId:undefined});
  expect(parseCandidateRoute('?job=https%3A%2F%2Fevil.example').tab).toBe('jobs');
  expect(candidateRouteUrl('https://example.test/HRIS-Candidate-v2/', {tab:'privileged-admin'})).toBe('/HRIS-Candidate-v2/');
});

test('all original candidate route tabs round-trip without new navigation options', () => {
  for(const tab of ['dashboard','cv-builder','interviews','tasks','offers','preboarding','profile','saved-jobs','about']) {
    const href=candidateRouteUrl('https://example.test/HRIS-Candidate-v2/', {tab});
    expect(parseCandidateRoute(new URL(href,'https://example.test').search).tab).toBe(tab);
  }
});
