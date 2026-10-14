import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptLiveApplication } from '../src/lib/recruitmentAdapters.ts';

const page = readFileSync(new URL('../src/pages/VerifiedApplyPage.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const localJourney = readFileSync(new URL('./candidate-application-local-e2e.mjs', import.meta.url), 'utf8');
const localFixture = readFileSync(new URL('./candidate-application-local-fixture.sql', import.meta.url), 'utf8');

test('live application sends profile-backed contact details and verified document ids', () => {
  assert.match(page, /uploadCandidateApplicationDocument/);
  assert.match(page, /document_ids:\s*\[/);
  assert.match(page, /required_document_map:\s*requiredDocumentMap/);
  assert.match(page, /full_name:\s*fullName\.trim\(\)/);
  assert.match(page, /phone:\s*phone\.trim\(\)/);
  assert.match(api, /selected_cv_id:\s*payload\.cv_id/);
  assert.match(api, /document_ids:\s*payload\.document_ids\s*\|\|\s*\[\]/);
  assert.match(api, /required_document_map:\s*payload\.required_document_map\s*\|\|\s*\{\}/);
});

test('server drafts resume application fields and document selections without contact PII', () => {
  assert.match(page, /loadVerifiedApplicationDraft/);
  assert.match(page, /saveVerifiedApplicationDraft/);
  assert.match(page, /setDocumentIds\(draft\.documentIds/);
  assert.match(api, /documentIds:\s*draft\.documentIds\s*\|\|\s*\[\]/);
  assert.match(api, /requiredDocumentMap:\s*draft\.requiredDocumentMap\s*\|\|\s*\{\}/);
  const saveStart = api.indexOf('export async function saveVerifiedApplicationDraft');
  const draftStart = api.indexOf('draft_data: {', saveStart);
  const draftEnd = api.indexOf("}, { onConflict: 'candidate_user_id,job_id'", draftStart);
  const draftPayload = draftStart >= 0 && draftEnd > draftStart ? api.slice(draftStart, draftEnd) : '';
  assert.ok(draftPayload, 'Verified draft upsert contract is present.');
  assert.doesNotMatch(draftPayload, /full_name|phone|email|fileUrl/);
});

test('live flat application DTO maps job title, department, status, and screening answers', () => {
  const app = adaptLiveApplication({
    id: 'application-1',
    candidate_user_id: 'candidate-1',
    job_id: 'job-1',
    job_title: 'People Operations Lead',
    department_name: 'People',
    stage: 'applied',
    applied_at: '2026-10-13T08:00:00.000Z',
    application_data: {
      selected_cv_id: 'cv-1',
      answers: [{ questionId: 'q-1', answer: ['Bangla', 'English'] }],
      declarations: { recruitmentDataConsent: true }
    }
  });

  assert.equal(app.job_title, 'People Operations Lead');
  assert.equal(app.department, 'People');
  assert.equal(app.status, 'submitted');
  assert.deepEqual(app.screening_answers, { 'q-1': ['Bangla', 'English'] });
  assert.equal(app.consent_given, true);
  assert.equal(app.submitted_at, '2026-10-13T08:00:00.000Z');
});

test('live application DTO preserves candidate-visible persisted history and drops internal notes', () => {
  const app = adaptLiveApplication({
    id: 'application-history-1', candidate_user_id: 'candidate-1', job_id: 'job-1',
    stage: 'interview_scheduled', applied_at: '2026-10-13T08:00:00.000Z',
    application_data: {},
    stage_history: [
      { id: 'history-1', application_id: 'application-history-1', stage: 'applied', note: 'Application submitted.', actor_type: 'candidate', actor_user_id: 'candidate-1', created_at: '2026-10-13T08:00:00.000Z' },
      { id: 'history-2', application_id: 'application-history-1', stage: 'interview_scheduled', note: 'private recruiter panel note', actor_type: 'recruiter', actor_user_id: 'recruiter-1', created_at: '2026-10-13T10:00:00.000Z' },
    ],
  });

  assert.deepEqual(app.stage_history, [
    { id: 'history-1', application_id: 'application-history-1', stage: 'applied', created_at: '2026-10-13T08:00:00.000Z', note: 'Application submitted.' },
    { id: 'history-2', application_id: 'application-history-1', stage: 'interview_scheduled', created_at: '2026-10-13T10:00:00.000Z' },
  ]);
  assert.equal(JSON.stringify(app).includes('private recruiter panel note'), false);
  assert.equal(JSON.stringify(app).includes('recruiter-1'), false);
});

test('application page renders stored stage history rather than inferred screening milestones', () => {
  const applicationsPage = readFileSync(new URL('../src/pages/ApplicationsPage.tsx', import.meta.url), 'utf8');
  assert.match(applicationsPage, /app\.stage_history/);
  assert.match(applicationsPage, /Application History/);
  assert.match(applicationsPage, /No application history updates are available yet/);
  assert.doesNotMatch(applicationsPage, /Verified qualification criteria & resume mapping/);
});

test('fresh local application journey creates its schema before cleaning stale test jobs', () => {
  const baseSchemaAt = localJourney.indexOf("psql(readFileSync(path.join(mainRoot, 'tests/sql/candidate-c1/tenant-fixture.sql'), 'utf8'))");
  const fixtureAt = localJourney.indexOf("psql(readFileSync(path.join(candidateRoot, 'tests/candidate-application-local-fixture.sql'), 'utf8'))");
  const migrationAt = localJourney.indexOf('for (const migration of migrationPaths) psql(readFileSync(migration, \'utf8\'))');
  const cleanupAt = localJourney.indexOf('await cleanupStaleTestJobs();', migrationAt);
  const collisionCheckAt = localJourney.indexOf('SELECT count(*) FROM public.jobs', cleanupAt);
  const jobInsertAt = localJourney.indexOf('const testJob = {', cleanupAt);
  assert.ok(baseSchemaAt >= 0 && baseSchemaAt < fixtureAt, 'Shared synthetic candidate schema loads before local workflow fixtures.');
  assert.ok(fixtureAt >= 0 && fixtureAt < migrationAt, 'Disposable workflow fixture loads before product migrations.');
  assert.ok(migrationAt >= 0 && migrationAt < cleanupAt, 'Product schema loads before stale-job cleanup.');
  assert.ok(cleanupAt >= 0 && cleanupAt < jobInsertAt, 'Stale local fixtures are removed before the new local job is inserted.');
  assert.ok(collisionCheckAt > cleanupAt && collisionCheckAt < jobInsertAt, 'Job collision checks run only after the disposable schema is initialized.');
  assert.doesNotMatch(localJourney.slice(0, fixtureAt), /await cleanupStaleTestJobs\(\)/,
    'No table cleanup runs against an uninitialized database.');
  assert.doesNotMatch(localJourney.slice(0, baseSchemaAt), /SELECT count\(\) FROM public\.jobs/,
    'No job-table query runs before the disposable schema is initialized.');
  assert.match(localJourney, /20261014150000_hris_candidate_initial_application_history\.sql/,
    'The local Auth/Postgres application journey applies the persisted-history source fix.');
});

test('local preboarding tenant policy is created only after its permission helper exists', () => {
  const helperAt = localFixture.indexOf('CREATE OR REPLACE FUNCTION public.has_tenant_permission');
  const policyAt = localFixture.indexOf('CREATE POLICY c1_tenant_membership_read');
  assert.ok(helperAt >= 0 && helperAt < policyAt, 'Tenant helper is defined before the policy calls it.');
  assert.match(localFixture, /ON CONFLICT \(slug\) DO UPDATE[\s\S]+timezone=EXCLUDED\.timezone/,
    'The disposable tenant fixture reapplies its declared organization timezone on reruns.');
});
