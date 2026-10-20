import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptLiveApplication } from '../src/lib/recruitmentAdapters.ts';
import { translateCandidateText } from '../src/lib/candidateLocale.ts';

const page = readFileSync(new URL('../src/pages/VerifiedApplyPage.tsx', import.meta.url), 'utf8');
const savedJobsPage = readFileSync(new URL('../src/pages/VerifiedSavedJobsPage.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const localJourney = readFileSync(new URL('./candidate-application-local-e2e.mjs', import.meta.url), 'utf8');
const localFixture = readFileSync(new URL('./candidate-application-local-fixture.sql', import.meta.url), 'utf8');
const mainRoot = process.env.HRIS_MAIN_REPO_ROOT || fileURLToPath(new URL('../../HRIS-v2', import.meta.url));
const canonicalMatrixBytes = readFileSync(path.join(mainRoot, 'docs/programme/recovered-source/CANONICAL_USER_STORY_MATRIX.json'));
const canonicalMatrixHash = createHash('sha256').update(canonicalMatrixBytes).digest('hex');
const canonicalMatrix = JSON.parse(canonicalMatrixBytes.toString('utf8'));

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

test('verified canonical CA14-12 source is covered by persisted Auth/Postgres application evidence', () => {
  assert.equal(canonicalMatrixHash, 'c0f8eb8ea4fa7a1cd17e957629642c957ae0c22d706f07d0b2c3f1a2a77ed520');
  const story = canonicalMatrix.stories.find(item => item.story_id === 'CA14-12');
  assert.equal(story?.verbatim_requirement,
    'As a candidate, I want the submitted application snapshot preserved even if I later edit my profile.');
  assert.match(localJourney, /CA14-12: As a candidate, I want the submitted application snapshot preserved even if I later edit my profile\./);
  assert.match(localJourney, /CA14-12_APPLICATION_SNAPSHOT_IMMUTABLE_AFTER_PROFILE_EDIT_PASS/);
});

test('all canonical CA14 job-application stories have a concrete local Auth/Postgres browser evidence checkpoint', () => {
  assert.equal(canonicalMatrixHash, 'c0f8eb8ea4fa7a1cd17e957629642c957ae0c22d706f07d0b2c3f1a2a77ed520');
  const stories = canonicalMatrix.stories.filter(item => item.module_id === 'CA14');
  assert.equal(stories.length, 12, 'Canonical CA14 module contains the 12 original Job Application stories.');
  for (const story of stories) {
    assert.ok(story.verbatim_requirement?.startsWith('As a candidate,'), `${story.story_id} retains its original source requirement.`);
    assert.match(localJourney, new RegExp(`acceptedCa14Stories\\.add\\(['\"]${story.story_id}['\"]\\)`),
      `${story.story_id} is marked only at its Auth/Postgres browser evidence assertion.`);
  }
  assert.match(localJourney, /CANDIDATE_CA14_STORY_EVIDENCE PASS=12 FAIL=0/);
  assert.match(localJourney, /expectedCa14Stories\.every\(storyId => acceptedCa14Stories\.has\(storyId\)\)/);
});

test('canonical CA11 CV Builder stories are covered only through the existing candidate CV and profile contracts', () => {
  assert.equal(canonicalMatrixHash, 'c0f8eb8ea4fa7a1cd17e957629642c957ae0c22d706f07d0b2c3f1a2a77ed520');
  const stories = canonicalMatrix.stories.filter(item => item.module_id === 'CA11');
  assert.deepEqual(stories.map(story => story.story_id), ['CA11-01','CA11-02','CA11-03','CA11-04','CA11-05']);
  assert.match(localJourney, /candidate_cvs/);
  assert.match(localJourney, /candidate_update_profile/);
  for (const story of stories) {
    assert.ok(story.verbatim_requirement?.startsWith('As a candidate,'), `${story.story_id} retains its original source requirement.`);
    assert.match(localJourney, new RegExp(`acceptedCa11Stories\\.add\\(['"]${story.story_id}['"]\\)`),
      `${story.story_id} is marked only at its Auth/Postgres browser evidence assertion.`);
  }
  assert.match(localJourney, /CANDIDATE_CA11_STORY_EVIDENCE PASS=5 FAIL=0/);
  assert.match(localJourney, /expectedCa11Stories\.every\(storyId => acceptedCa11Stories\.has\(storyId\)\)/);
  assert.match(localJourney, /getDocument\(\{ data: new Uint8Array\(cvPdfBytes\) \}\)/);
});

test('canonical CA12 Saved Jobs stories use the existing owner-scoped saved-job table and published-job projection', () => {
  assert.equal(canonicalMatrixHash, 'c0f8eb8ea4fa7a1cd17e957629642c957ae0c22d706f07d0b2c3f1a2a77ed520');
  const stories = canonicalMatrix.stories.filter(item => item.module_id === 'CA12');
  assert.deepEqual(stories.map(story => story.story_id), ['CA12-01','CA12-02','CA12-03','CA12-04']);
  assert.deepEqual(stories.map(story => story.verbatim_requirement), [
    'As a candidate, I want to save an open job.',
    'As a candidate, I want to remove a saved job.',
    'As a candidate, I want to see saved jobs later.',
    'As a candidate, I want closed saved jobs identified clearly.',
  ]);
  assert.match(api, /from\('candidate_saved_jobs'\)\.select\('job_id'\)/);
  assert.match(api, /from\('candidate_saved_jobs'\)\s*\.insert\(\{candidate_user_id:userId,job_id:jobId\}\)/);
  assert.match(api, /from\('candidate_published_jobs'\)\.select\('\*'\)[\s\S]*?\.eq\('status', 'published'\)[\s\S]*?\.eq\('is_published', true\)[\s\S]*?\.eq\('is_active', true\)/);
  assert.match(savedJobsPage, /This saved vacancy is no longer published\./);
  assert.match(localFixture, /c1_apply_saved_jobs_select_own[\s\S]*?candidate_user_id=\(SELECT auth\.uid\(\)\)/);
  for (const story of stories) {
    assert.match(localJourney, new RegExp(`acceptedCa12Stories\\.add\\(['"]${story.story_id}['"]\\)`),
      `${story.story_id} is marked at its signed-in synthetic browser and database assertion.`);
  }
  assert.match(localJourney, /CANDIDATE_CA12_STORY_EVIDENCE PASS=4 FAIL=0/);
  assert.match(localJourney, /expectedCa12Stories\.every\(storyId => acceptedCa12Stories\.has\(storyId\)\)/);
  assert.match(localJourney, /closed saved vacancy in the disposable projection/);
});

test('canonical CA13 Job Alerts stories use only the existing owner-scoped alert and notification tables', () => {
  assert.equal(canonicalMatrixHash, 'c0f8eb8ea4fa7a1cd17e957629642c957ae0c22d706f07d0b2c3f1a2a77ed520');
  const stories = canonicalMatrix.stories.filter(item => item.module_id === 'CA13');
  assert.deepEqual(stories.map(story => story.story_id), ['CA13-01','CA13-02','CA13-03','CA13-04','CA13-05']);
  assert.deepEqual(stories.map(story => story.verbatim_requirement), [
    'As a candidate, I want to create a job alert.',
    'As a candidate, I want to define relevant criteria.',
    'As a candidate, I want to enable/disable an alert.',
    'As a candidate, I want to edit/delete alerts.',
    'As a candidate, I want notifications only when relevant jobs meet the criteria.',
  ]);
  assert.match(api, /from\('candidate_job_alerts'\)\.insert\(/);
  assert.match(api, /export async function updateVerifiedCandidateJobAlert[\s\S]*?\.update\([\s\S]*?\.eq\('id', alertId\)\.eq\('candidate_user_id', userId\)/);
  assert.match(api, /export async function setVerifiedCandidateJobAlertActive[\s\S]*?\.update\(\{ is_active: isActive \}\)[\s\S]*?\.eq\('id', alertId\)\.eq\('candidate_user_id', userId\)/);
  assert.match(api, /export async function deleteVerifiedCandidateJobAlert[\s\S]*?\.eq\('id', alertId\)\.eq\('candidate_user_id', userId\)/);
  assert.match(localFixture, /c1_candidate_job_alerts_own[\s\S]*?candidate_user_id=\(SELECT auth\.uid\(\)\)/);
  assert.match(savedJobsPage, /aria-label=\{t\('Edit \{title\} alert'/);
  assert.match(savedJobsPage, /Pause \{title\} alert/);
  assert.match(localFixture, /c1_notify_matching_job_alerts[\s\S]*?EXISTS \([\s\S]*?regexp_split_to_table\(alert\.keywords/);
  for (const story of stories) {
    assert.match(localJourney, new RegExp(`acceptedCa13Stories\\.add\\(['"]${story.story_id}['"]\\)`),
      `${story.story_id} is marked at its signed-in synthetic browser and database assertion.`);
  }
  assert.match(localJourney, /CANDIDATE_CA13_STORY_EVIDENCE PASS=5 FAIL=0/);
  assert.match(localJourney, /expectedCa13Stories\.every\(storyId => acceptedCa13Stories\.has\(storyId\)\)/);
  assert.match(localJourney, /unrelated vacancy generated an alert notification/);
  assert.match(localJourney, /Job-alert controls overflow the 375px candidate viewport/);
  assert.match(localJourney, /Job-alert controls overflow the 1280px candidate viewport/);
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
  assert.match(localJourney, /const desktopInterviewCompletedTimeline = page\.locator\(`#application-history-\$\{interviewCompletedApplicationId\}`\)/);
  assert.match(localJourney, /desktopInterviewCompletedTimeline\.getByText\('Interview Under Evaluation'/);
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

test('canonical CA15 My Applications stories have isolated signed-in runtime evidence', () => {
  assert.match(api, /rpc\('candidate_get_recruitment_context'\)/);
  assert.match(api, /rpc\('candidate_withdraw_application'/);
  assert.match(localJourney, /CANDIDATE_CA15_STORY_EVIDENCE PASS=8 FAIL=0 stories=\$\{expectedCa15Stories\.join\(','\)\}/);
  assert.match(localJourney, /Array\.from\(\{ length: 8 \}, \(_, index\) => `CA15-/);
  assert.match(localJourney, /candidateBApplicationCards\.count\(\) === 3[\s\S]*?acceptedCa15Stories\.add\('CA15-01'\)/);
  assert.match(localJourney, /candidateSubmittedDate[\s\S]*?acceptedCa15Stories\.add\('CA15-04'\)/);
  assert.match(localJourney, /Check Interviews[\s\S]*?Assessments & Documents[\s\S]*?acceptedCa15Stories\.add\('CA15-05'\)/);
  assert.match(localJourney, /persistedTimeline\.includes\('private recruiter'\)[\s\S]*?acceptedCa15Stories\.add\('CA15-06'\)/);
  assert.match(localJourney, /acceptedCa15Stories\.add\('CA15-07'\)[\s\S]*?acceptedCa15Stories\.add\('CA15-08'\)/);
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
