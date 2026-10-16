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
  assert.match(applicationsPage, /role="alert"[^>]*>\{t\('Your applicatio