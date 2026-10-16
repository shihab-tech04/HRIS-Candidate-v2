import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptLiveApplication } from '../src/lib/recruitmentAdapters.ts';
import { translateCandidateText } from '../src/lib/candidateLocale.ts';

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

test('completed interview stage keeps the approved Candidate label in English and Bengali', () => {
  const app = adaptLiveApplication({
    id: 'application-interview-completed', candidate_user_id: 'candidate-1', job_id: 'job-1',
    stage: 'interview_completed', applied_at: '2026-10-16T08:00:00.000Z', application_data: {},
  });
  assert.equal(app.status, 'interview_completed');
  assert.equal(app.candidate_visible_status, 'Interview Under Evaluation');
  assert.equal(translateCandidateText('Interview Under Evaluation', 'bn'), 'সাক্ষাৎকার মূল্যায়নাধীন');
  const applicationsPage = readFileSync(new URL('../src/pages/ApplicationsPage.tsx', import.meta.url), 'utf8');
  assert.match(applicationsPage, /interview_completed: 'Interview Under Evaluation'/);
});

test('local Auth/Postgres browser acceptance verifies completed interview visibility and private-history denial', () => {
  assert.match(localJourney, /20261016081154_hris_candidate_interview_completion\.sql/);
  assert.match(localJourney, /Interview Under Evaluation/);
  assert.match(localJourney, /সাক্ষাৎকার মূল্যায়নাধীন/);
  assert.match(localJourney, /Private completed-interview recruiter note\./);
  assert.match(localJourney, /directInterviewCompletedHistory\.error\?\.code === '42501'/);
  assert.match(localJourney, /interview_completed=visible\+candidate-safe/);
});

test('application page renders stored stage history rather than inferred screening milestones', () => {
  const applicationsPage = readFileSync(new URL('../src/pages/ApplicationsPage.tsx', import.meta.url), 'utf8');
  assert.match(applicationsPage, /app\.stage_history/);
  assert.match(applicationsPage, /Application History/);
  assert.match(applicationsPage, /\{t\(entry\.note\)\}/, 'Candidate-visible history notes use the selected locale, preserving unknown candidate-authored text.');
  assert.match(applicationsPage, /No application history updates are available yet/);
  assert.doesNotMatch(applicationsPage, /Verified qualification criteria & resume mapping/);
});

test('application history and withdrawal recovery use the shared EN/BN locale and preserve reason values', () => {
  const applicationsPage = readFileSync(new URL('../src/pages/ApplicationsPage.tsx', import.meta.url), 'utf8');
  assert.match(applicationsPage, /useCandidateLocale/);
  assert.match(applicationsPage, /date\.toLocaleString\(locale === 'bn' \? 'bn-BD' : 'en-US'\)/);
  assert.match(applicationsPage, /date\.toLocaleDateString\(locale === 'bn' \? 'bn-BD' : 'en-US'\)/);
  assert.match(applicationsPage, /stageLabel\(app\.status \|\| app\.candidate_visible_status\)/);
  assert.match(applicationsPage, /role="alert"[^>]*>\{t\('Your applications could not be loaded\. Please try again\.'\)\}/);
  assert.match(applicationsPage, /<option value="Accepted another job offer">\{t\('Accepted another job offer'\)\}<\/option>/);
  assert.match(applicationsPage, /<option value="Location \/ Commute constraints">\{t\('Location \/ Commute constraints'\)\}<\/option>/);
  assert.match(applicationsPage, /<option value="Compensation expectations mismatch">\{t\('Compensation expectations mismatch'\)\}<\/option>/);
  assert.equal(translateCandidateText('My Applications', 'bn'), 'আমার আবেদন');
  assert.equal(translateCandidateText('Interview Scheduled', 'bn'), 'সাক্ষাৎকার নির্ধারিত হয়েছে');
  assert.equal(translateCandidateText('Submitted {date}', 'bn', { date: '১৫ অক্টোবর ২০২৬' }), '১৫ অক্টোবর ২০২৬-এ জমা');
});

test('Candidate withdrawal is server-persisted and preserves existing offer-stage action behavior', () => {
  const applicationsPage = readFileSync(new URL('../src/pages/ApplicationsPage.tsx', import.meta.url), 'utf8');
  assert.match(api, /rpc\('candidate_withdraw_application'/);
  assert.match(applicationsPage, /!isWithdrawn && !isRejected && \(/);
  assert.match(localJourney, /20261016190000_candidate_application_withdrawal\.sql/);
  assert.match(localJourney, /candidateCannotWithdrawOtherTenant[\s\S]*?anonymousWithdrawal[\s\S]*?invalidWithdrawalReason[\s\S]*?rejectedApplicationWithdrawal/);
  assert.match(localJourney, /withdrawal=owner\+tenant\+rejected-stage\+offer-stage-preserved\+allowlisted-reason\+idempotent\+audited-history\+retry\+refresh\+ENBN/);
  assert.match(localJourney, /setViewportSize\(\{ width: 375, height: 812 \}\)[\s\S]*?setViewportSize\(\{ width: 1280, height: 800 \}\)/);
});

test('application withdrawal dialog has labelled modal semantics, keyboard containment and recoverable errors', () => {
  const applicationsPage = readFileSync(new URL('../src/pages/ApplicationsPage.tsx', import.meta.url), 'utf8');
  assert.match(applicationsPage, /role="dialog" aria-modal="true" aria-labelledby="withdraw-application-title" aria-describedby="withdraw-application-description"/);
  assert.match(applicationsPage, /window\.requestAnimationFrame\(\(\) => withdrawalDialogRef\.current\?\.focus\(\)\)/);
  assert.match(applicationsPage, /event\.key === 'Escape'[\s\S]*?closeWithdrawalDialog\(\)/);
  assert.match(applicationsPage, /event\.shiftKey[\s\S]*?last\.focus\(\)/);
  assert.match(applicationsPage, /previouslyFocused\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(applicationsPage, /catch \{[\s\S]*?setActionError\(t\('We could not withdraw your application\. Please try again\.'\)\)/);
  assert.match(applicationsPage, /disabled=\{withdrawing\}[\s\S]*?\{t\('Cancel'\)\}/);
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
  assert.match(localJourney, /20261016081154_hris_candidate_interview_completion\.sql/,
    'The local Candidate acceptance applies the interview-completion stage contract.');
  assert.ok(localJourney.includes('Interview Under Evaluation') && localJourney.includes('সাক্ষাৎকার মূল্যায়নাধীন'),
    'The local browser journey checks the English and Bengali completed-interview status.');
});

test('local preboarding tenant policy is created only after its permission helper exists', () => {
  const helperAt = localFixture.indexOf('CREATE OR REPLACE FUNCTION public.has_tenant_permission');
  const policyAt = localFixture.indexOf('CREATE POLICY c1_tenant_membership_read');
  assert.ok(helperAt >= 0 && helperAt < policyAt, 'Tenant helper is defined before the policy calls it.');
  assert.match(localFixture, /ON CONFLICT \(slug\) DO UPDATE[\s\S]+timezone=EXCLUDED\.timezone/,
    'The disposable tenant fixture reapplies its declared organization timezone on reruns.');
});
