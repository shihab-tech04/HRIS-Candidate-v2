import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const candidateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainRoot = process.env.HRIS_MAIN_REPO_ROOT || path.resolve(candidateRoot, '../HRIS-v2');
const workdir = process.env.HRIS_CANDIDATE_C1_TEST_WORKDIR || '/private/tmp/synesis-candidate-c1-auth-20261013-1124';
const dockerContext = process.env.HRIS_DOCKER_CONTEXT || 'colima-hris-scratch';
const apiPort = process.env.HRIS_CANDIDATE_C1_API_PORT || '55721';
const webPort = process.env.HRIS_CANDIDATE_APPLICATION_E2E_PORT || '35522';
const cliEnv = {
  ...process.env,
  SUPABASE_HOME: process.env.SUPABASE_HOME || '/private/tmp/synesis-supabase-home',
  SUPABASE_TELEMETRY_DISABLED: '1',
  DOCKER_CONTEXT: dockerContext,
};
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: candidateRoot, env: cliEnv, encoding: 'utf8', ...options,
});
const parseEnv = raw => Object.fromEntries(raw.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  return match ? [[match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]] : [];
}));
const psql = sql => run('docker', [
  '--context', dockerContext, 'exec', '-i', `supabase_db_${path.basename(workdir)}`,
  'psql', '-X', '-A', '-t', '-q', '--set=ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres',
], { input: sql });
const parseCliEnv = parseEnv(run('supabase', ['status', '--output', 'env', '--workdir', workdir]));
const status = parseCliEnv;
const config = readFileSync(path.join(workdir, 'supabase/config.toml'), 'utf8');
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (projectId !== path.basename(workdir) || !projectId.startsWith('synesis-candidate-c1-auth-')) {
  throw new Error('Refusing to run against a non-dedicated Candidate C1 test project.');
}
const apiUrl = new URL(status.API_URL);
if (apiUrl.hostname !== '127.0.0.1' || apiUrl.port !== apiPort) {
  throw new Error('Refusing to run outside the dedicated local Candidate API port.');
}
if (run('docker', ['--context', dockerContext, 'context', 'show']).trim() !== dockerContext) {
  throw new Error('Refusing to run without the isolated HRIS Docker context.');
}
const candidateRequire = createRequire(path.join(candidateRoot, 'package.json'));
const mainRequire = createRequire(path.join(mainRoot, 'package.json'));
const { createClient } = candidateRequire('@supabase/supabase-js');
const { chromium } = mainRequire('playwright');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const tenantA = '22222222-2222-4222-8222-222222222222';
const tenantB = '33333333-3333-4333-8333-333333333333';
const jobId = randomUUID();
const otherTenantJobId = randomUUID();
const foreignApplicationId = randomUUID();
const foreignOfferId = randomUUID();
const password = `candidate-apply-${randomUUID()}`;
const users = [
  { email: `candidate-apply-a-${Date.now()}@c1.test`, name: 'Candidate A', tenantId: tenantA },
  { email: `candidate-apply-b-${Date.now()}@c1.test`, name: 'Candidate B', tenantId: tenantB },
];
const staff = [
  { email: `c1-preboarding-manager-a-${Date.now()}@c1.test`, tenantId: tenantA, permission: 'recruitment.manage' },
  { email: `c1-preboarding-viewer-a-${Date.now()}@c1.test`, tenantId: tenantA, permission: 'recruitment.view' },
  { email: `c1-preboarding-manager-b-${Date.now()}@c1.test`, tenantId: tenantB, permission: 'recruitment.manage' },
];
const createdUsers = [];
const profiles = [];
const signedClients = [];
let server;
let mainServer;
let browser;
let checks = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); checks++; };
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const organizationDateTime = daysAhead => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + daysAhead * 86400000)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

async function cleanupTestUser(userId) {
  const applications = await admin.from('job_applications').select('id').eq('candidate_user_id', userId);
  if (applications.error) throw applications.error;
  const applicationIds = applications.data.map(row => row.id);
  if (applicationIds.length) {
    for (const table of ['onboarding_handoffs', 'job_offers', 'interviews', 'candidate_assessments', 'candidate_application_stage_history']) {
      const deleted = await admin.from(table).delete().in('application_id', applicationIds);
      if (deleted.error) throw deleted.error;
    }
  }
  const cvRows = await admin.from('candidate_cvs').select('document_url').eq('candidate_user_id', userId);
  const profileRow = await admin.from('candidate_profiles').select('profile_data').eq('user_id', userId).maybeSingle();
  const documentRows = profileRow.data?.profile_data?.documents;
  const paths = [
    ...(cvRows.data || []).map(row => row.document_url),
    ...(Array.isArray(documentRows) ? documentRows.map(row => row?.fileUrl) : []),
  ].filter(path => typeof path === 'string' && path.startsWith(`${userId}/`));
  if (paths.length) {
    const removedFiles = await admin.storage.from('candidate-documents').remove(paths);
    if (removedFiles.error) throw removedFiles.error;
  }
  for (const table of ['job_applications', 'candidate_application_drafts', 'candidate_cvs']) {
    const deletedRows = await admin.from(table).delete().eq('candidate_user_id', userId);
    if (deletedRows.error) throw deletedRows.error;
  }
  const access = await admin.from('c1_preboarding_access').delete().eq('user_id', userId);
  if (access.error) throw access.error;
  const membership = await admin.from('tenant_memberships').delete().eq('user_id', userId);
  if (membership.error) throw membership.error;
  const deletedProfile = await admin.from('candidate_profiles').delete().eq('user_id', userId);
  if (deletedProfile.error) throw deletedProfile.error;
  const deletedUser = await admin.auth.admin.deleteUser(userId);
  if (deletedUser.error) throw deletedUser.error;
}

async function cleanupStaleTestJobs() {
  const rows = await admin.from('jobs').select('id,title,reference_number').like('reference_number', 'C1-%');
  if (rows.error) throw rows.error;
  const ids = rows.data.filter(row =>
    (row.title === 'Senior Systems Engineer' && /^C1-[0-9a-f]{8}$/i.test(row.reference_number || ''))
    || (row.title === 'Other Tenant Role' && /^C1-X-[0-9a-f]{8}$/i.test(row.reference_number || ''))
  ).map(row => row.id);
  if (ids.length) {
    const applications = await admin.from('job_applications').select('id').in('job_id', ids);
    if (applications.error) throw applications.error;
    const applicationIds = applications.data.map(row => row.id);
    if (applicationIds.length) {
      const assessments = await admin.from('candidate_assessments').delete().in('application_id', applicationIds);
      if (assessments.error) throw assessments.error;
    }
    const apps = await admin.from('job_applications').delete().in('job_id', ids);
    if (apps.error) throw apps.error;
    const published = await admin.from('candidate_published_jobs').delete().in('id', ids);
    if (published.error) throw published.error;
    const jobs = await admin.from('jobs').delete().in('id', ids);
    if (jobs.error) throw jobs.error;
  }
}

const migrationPaths = [
  path.join(mainRoot, 'supabase/migrations/20261013075939_hris_candidate_apply_rpc_source.sql'),
  path.join(mainRoot, 'supabase/migrations/20261014150000_hris_candidate_initial_application_history.sql'),
  path.join(mainRoot, 'supabase/migrations/20261014012249_recruiter_application_stage_transition.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013080630_hris_candidate_application_document.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013113718_hris_candidate_context_active_profile_tenant_scope.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013120355_hris_candidate_profile_rpcs_active_tenant_scope.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013130829_hris_recruitment_pipeline_read.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013132335_hris_recruitment_offer_issue.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013190200_hris_candidate_preboarding_workflow.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013052128_hris_candidate_c1_revoke_direct_table_access.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013221500_hris_candidate_interview_journey.sql'),
  path.join(mainRoot, 'supabase/migrations/20261013170556_hris_candidate_assessment_journey.sql'),
];
for (const migration of migrationPaths) readFileSync(migration, 'utf8');

const startUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (startUsers.error) throw startUsers.error;
const staleTestUsers = startUsers.data.users.filter(user => /^(?:candidate-apply-[ab]|c1-preboarding-(?:manager-a|viewer-a|manager-b))-\d+@c1\.test$/.test(user.email || ''));
const otherExistingUsers = startUsers.data.users.filter(user => !staleTestUsers.includes(user));
if (otherExistingUsers.length) {
  throw new Error('Refusing to change local Auth because the dedicated test stack contains entries not created by this application test.');
}
for (const staleUser of staleTestUsers) await cleanupTestUser(staleUser.id);
const cleanUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (cleanUsers.error || cleanUsers.data.users.length !== 0) throw cleanUsers.error || new Error('Local Auth did not return to an empty state.');

try {
  psql(readFileSync(path.join(mainRoot, 'tests/sql/candidate-c1/cleanup-fixture.sql'), 'utf8'));
  psql(readFileSync(path.join(mainRoot, 'tests/sql/candidate-c1/tenant-fixture.sql'), 'utf8'));
  psql(readFileSync(path.join(candidateRoot, 'tests/candidate-application-local-fixture.sql'), 'utf8'));
  for (const migration of migrationPaths) psql(readFileSync(migration, 'utf8'));
  await cleanupStaleTestJobs();
  const idCollision = psql(`SELECT count(*) FROM public.jobs WHERE id IN (${sql(jobId)},${sql(otherTenantJobId)})`).trim();
  if (idCollision !== '0') throw new Error('Refusing to overwrite a local test job.');

  const testJob = {
    id: jobId, tenant_id: tenantA, reference_number: `C1-${jobId.slice(0, 8)}`,
    title: 'Senior Systems Engineer', department_name: 'Engineering', team_name: 'Platform',
    location_name: 'Dhaka', workplace_type: 'Hybrid', employment_type: 'Full-time',
    vacancy_count: 1, min_experience_years: 2, skills: ['PostgreSQL'],
    responsibilities: ['Build safe systems'], requirements: ['Production SQL experience'],
    benefits: [], required_documents: ['Degree certificate'],
    screening_questions: [{ id: 'privacy-experience', questionText: 'Describe a privacy control you have implemented.', type: 'text', required: true }],
    instructions: 'Local acceptance vacancy', application_deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    status: 'published', is_published: true, is_active: true, published_at: new Date().toISOString(),
  };
  const insertedJob = await admin.from('jobs').insert(testJob);
  if (insertedJob.error) throw insertedJob.error;
  const publicJob = await admin.from('candidate_published_jobs').insert({
    id: jobId, tenant_id: tenantA, reference_number: testJob.reference_number,
    title: testJob.title, department_name: testJob.department_name,
    team_name: testJob.team_name, location_name: testJob.location_name,
    workplace_type: testJob.workplace_type, employment_type: testJob.employment_type,
    vacancy_count: 1, responsibilities: testJob.responsibilities,
    requirements: testJob.requirements, benefits: [], required_documents: testJob.required_documents,
    screening_questions: testJob.screening_questions, instructions: testJob.instructions,
    application_deadline: testJob.application_deadline, status: 'published',
    is_published: true, is_active: true, published_at: new Date().toISOString(),
  });
  if (publicJob.error) throw publicJob.error;

  const otherJob = await admin.from('jobs').insert({
    id: otherTenantJobId, tenant_id: tenantB, reference_number: `C1-X-${otherTenantJobId.slice(0, 8)}`,
    title: 'Other Tenant Role', workplace_type: 'Remote', employment_type: 'Full-time',
    status: 'published', is_published: true, is_active: true,
    required_documents: [], screening_questions: [],
  });
  if (otherJob.error) throw otherJob.error;

  for (const user of users) {
    const created = await admin.auth.admin.createUser({
      email: user.email, password, email_confirm: true, user_metadata: { full_name: user.name },
    });
    if (created.error || !created.data.user) throw created.error || new Error('Could not create local test Auth user.');
    user.id = created.data.user.id;
    createdUsers.push(user.id);
    const profile = await admin.from('candidate_profiles').insert({
      user_id: user.id, tenant_id: user.tenantId, email: user.email, full_name: user.name,
      phone: '+8801700000000', profile_status: 'active', skills: ['PostgreSQL'],
      profile_data: { marker: `application-${user.name}`, documents: [] },
    });
    if (profile.error) throw profile.error;
    profiles.push(user.id);
    const signed = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await signed.auth.signInWithPassword({ email: user.email, password });
    if (login.error || !login.data.session) throw login.error || new Error('Local Auth did not issue a candidate session.');
    user.session = login.data.session;
    user.client = signed;
    signedClients.push(signed);
  }

  for (const person of staff) {
    const created = await admin.auth.admin.createUser({
      email: person.email, password, email_confirm: true, user_metadata: { full_name: person.email.split('@')[0] },
    });
    if (created.error || !created.data.user) throw created.error || new Error('Could not create local recruitment staff user.');
    person.id = created.data.user.id;
    createdUsers.push(person.id);
    const permissions = await admin.from('c1_preboarding_access').insert({
      user_id: person.id, tenant_id: person.tenantId, permission_id: person.permission,
    });
    if (permissions.error) throw permissions.error;
    const membership = await admin.from('tenant_memberships').insert({
      user_id: person.id, tenant_id: person.tenantId,
      role: person.permission === 'recruitment.manage' ? 'Recruitment Manager' : 'Recruitment Viewer', status: 'active',
    });
    if (membership.error) throw membership.error;
    const signed = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await signed.auth.signInWithPassword({ email: person.email, password });
    if (login.error || !login.data.session) throw login.error || new Error('Local Auth did not issue a recruitment staff session.');
    person.session = login.data.session;
    person.client = signed;
    signedClients.push(signed);
  }

  const foreignApplication = await admin.from('job_applications').insert({
    id: foreignApplicationId, tenant_id: tenantB, job_id: otherTenantJobId,
    candidate_user_id: users[1].id, full_name: users[1].name, email: users[1].email,
    stage: 'offer_accepted', application_data: {},
  });
  if (foreignApplication.error) throw foreignApplication.error;
  const foreignOffer = await admin.from('job_offers').insert({
    id: foreignOfferId, application_id: foreignApplicationId, offered_title: 'Other Tenant Role',
    salary_amount: 100000, salary_currency: 'BDT', status: 'accepted', pay_period: 'monthly',
    responded_at: new Date().toISOString(), acceptance_signature: users[1].name,
  });
  if (foreignOffer.error) throw foreignOffer.error;
  const foreignHandoff = await admin.from('onboarding_handoffs').insert({
    application_id: foreignApplicationId, status: 'in_progress',
    candidate_personal_data: { national_id: 'TEST-B-NID', nationality: 'Bangladeshi' },
    candidate_completed_steps: ['step_identity', 'step_emergency', 'step_payroll', 'step_policies'],
    candidate_submitted_at: new Date().toISOString(),
  });
  if (foreignHandoff.error) throw foreignHandoff.error;

  const managerAccessReads = await Promise.all([
    staff[0].client.from('tenant_memberships').select('tenant_id,role,status').eq('user_id', staff[0].id),
    staff[0].client.from('employees').select('tenant_id,employment_status').eq('user_id', staff[0].id),
    staff[0].client.from('admin_users').select('active,is_super_admin').eq('user_id', staff[0].id).maybeSingle(),
    staff[0].client.from('tenants').select('id,name,slug,timezone').eq('id', tenantA).maybeSingle(),
  ]);
  for (const [index, response] of managerAccessReads.entries()) {
    assert(!response.error, `Main workspace local authorization read ${index + 1} failed: ${JSON.stringify(response.error)}`);
  }
  assert(managerAccessReads[0].data.length === 1 && managerAccessReads[0].data[0].tenant_id === tenantA,
    'Main workspace did not return the active authorized tenant membership.');
  assert(managerAccessReads[3].data?.id === tenantA, 'Main workspace could not read the manager’s authorized tenant.');

  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', webPort, '--strictPort'], {
    cwd: candidateRoot,
    env: { ...process.env, VITE_SUPABASE_URL: status.API_URL, VITE_SUPABASE_ANON_KEY: status.ANON_KEY, VITE_ENABLE_DEMO_MODE: 'false' },
    stdio: 'ignore',
  });
  let ready = false;
  for (let index = 0; index < 60; index++) {
    if (server.exitCode !== null) throw new Error(`Candidate Vite exited early (${server.exitCode}).`);
    try { if ((await fetch(`http://127.0.0.1:${webPort}/`)).ok) { ready = true; break; } } catch {}
    await wait(250);
  }
  assert(ready, 'Candidate application server did not become ready.');
  const mainPort = process.env.HRIS_MAIN_PREBOARDING_E2E_PORT || '35523';
  mainServer = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', mainPort, '--strictPort'], {
    cwd: mainRoot,
    env: { ...process.env, VITE_SUPABASE_URL: status.API_URL, VITE_SUPABASE_ANON_KEY: status.ANON_KEY },
    stdio: 'ignore',
  });
  let mainReady = false;
  for (let index = 0; index < 60; index++) {
    if (mainServer.exitCode !== null) throw new Error(`Main HRIS Vite exited early (${mainServer.exitCode}).`);
    try { if ((await fetch(`http://127.0.0.1:${mainPort}/`)).ok) { mainReady = true; break; } } catch {}
    await wait(250);
  }
  assert(mainReady, 'Main HRIS application server did not become ready.');
  browser = await chromium.launch({ headless: true });

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobile.newPage();
  const browserErrors = [];
  let expectedSavedJobLookupFailure = false;
  let expectedSavedJobLookupFailureObserved = false;
  const networkDiagnostics = [];
  mobilePage.on('pageerror', error => browserErrors.push(error.message));
  mobilePage.on('console', message => {
    if (message.type() !== 'error') return;
    const messageUrl = message.location().url || '';
    const intentionalSavedJobFault = expectedSavedJobLookupFailure
      && (message.text().includes('/rest/v1/candidate_saved_jobs') || messageUrl.includes('/rest/v1/candidate_saved_jobs'))
      && (message.text().includes('select=id') || messageUrl.includes('select=id'));
    if (!intentionalSavedJobFault) browserErrors.push(`console: ${message.text()} at ${message.location().url || 'unknown URL'}`);
  });
  mobilePage.on('requestfailed', request => {
    const intentionalSavedJobFault = expectedSavedJobLookupFailure
      && request.url().includes('/rest/v1/candidate_saved_jobs')
      && request.url().includes('select=id');
    if (intentionalSavedJobFault) {
      expectedSavedJobLookupFailureObserved = true;
      return;
    }
    browserErrors.push(`request failed: ${request.url()} — ${request.failure()?.errorText || 'unknown error'}`);
  });
  mobilePage.on('response', response => networkDiagnostics.push(`${response.status()} ${response.request().method()} ${response.url()}`));
  await mobilePage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: users[0].session,
  });
  await mobilePage.goto(`http://127.0.0.1:${webPort}/?view=jobs`, { waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  const saveJob = mobilePage.getByRole('button', { name: 'Save Senior Systems Engineer for later' });
  await saveJob.waitFor({ timeout: 20000 });
  await saveJob.click();
  await mobilePage.getByRole('status').filter({ hasText: 'Senior Systems Engineer was saved to your account.' }).waitFor({ timeout: 20000 });
  const savedJobButton = mobilePage.getByRole('button', { name: 'Remove Senior Systems Engineer from saved jobs' });
  assert(await savedJobButton.getAttribute('aria-pressed') === 'true', 'Saved vacancy button did not expose its persisted pressed state.');
  const candidateASavedJob = await admin.from('candidate_saved_jobs').select('candidate_user_id,job_id,saved_at')
    .eq('candidate_user_id', users[0].id).eq('job_id', jobId).single();
  assert(!candidateASavedJob.error && candidateASavedJob.data.candidate_user_id === users[0].id
    && candidateASavedJob.data.job_id === jobId && Boolean(candidateASavedJob.data.saved_at),
  `Candidate save action did not persist to the owner-bound local table: ${JSON.stringify(candidateASavedJob.error)}`);
  const duplicateCandidateSave = await users[0].client.from('candidate_saved_jobs')
    .insert({ candidate_user_id: users[0].id, job_id: jobId });
  assert(duplicateCandidateSave.error?.code === '23505', 'Duplicate candidate saved-job pairs were not denied by the database unique key.');
  const candidateBCannotReadSavedJob = await users[1].client.from('candidate_saved_jobs').select('job_id')
    .eq('candidate_user_id', users[0].id);
  assert(!candidateBCannotReadSavedJob.error && candidateBCannotReadSavedJob.data.length === 0,
    'Candidate B could read Candidate A saved vacancies.');
  const candidateBForeignSave = await users[1].client.from('candidate_saved_jobs')
    .insert({ candidate_user_id: users[0].id, job_id: jobId });
  assert(candidateBForeignSave.error?.code === '42501', 'Candidate B could insert a saved vacancy for Candidate A.');
  const anonymousSavedJobs = await anon.from('candidate_saved_jobs').select('job_id');
  assert(Boolean(anonymousSavedJobs.error), 'Anonymous users could read candidate saved jobs.');

  await mobilePage.goto(`http://127.0.0.1:${webPort}/?view=saved-jobs`, { waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('heading', { name: 'My saved jobs' }).waitFor({ timeout: 20000 });
  await mobilePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  assert(!(await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile saved-jobs list overflows the viewport.');
  await mobilePage.reload({ waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  await mobilePage.setViewportSize({ width: 1280, height: 800 });
  assert(!(await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Desktop saved-jobs list overflows the viewport.');
  const secondCandidateClient = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const secondCandidatePage = await secondCandidateClient.newPage();
  await secondCandidatePage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: users[0].session,
  });
  await secondCandidatePage.goto(`http://127.0.0.1:${webPort}/?view=saved-jobs`, { waitUntil: 'domcontentloaded' });
  await secondCandidatePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  assert(!(await secondCandidatePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Second-client saved-jobs view overflows the desktop viewport.');
  await secondCandidateClient.close();
  const savedJobLookupEndpoint = /\/rest\/v1\/candidate_saved_jobs\?.*select=id/;
  await mobilePage.route(savedJobLookupEndpoint, route => route.abort());
  expectedSavedJobLookupFailure = true;
  await mobilePage.getByRole('button', { name: 'Remove', exact: true }).click();
  await mobilePage.getByRole('alert').getByRole('button', { name: 'Retry' }).waitFor({ timeout: 20000 });
  await mobilePage.unroute(savedJobLookupEndpoint);
  assert(expectedSavedJobLookupFailureObserved, 'Saved-job removal did not reach the simulated transient lookup failure.');
  await mobilePage.getByRole('button', { name: 'Retry' }).click();
  await mobilePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  expectedSavedJobLookupFailure = false;
  assert(await mobilePage.getByRole('button', { name: 'Remove', exact: true }).count() === 1, 'Saved job disappeared after a failed removal and list retry.');
  await mobilePage.getByRole('button', { name: 'Details' }).click();
  await mobilePage.getByRole('button', { name: 'Back to jobs' }).waitFor({ timeout: 20000 });
  await mobilePage.getByRole('button', { name: 'Back to jobs' }).click();
  await mobilePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  await mobilePage.goto(`http://127.0.0.1:${webPort}/?view=saved-jobs`, { waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('button', { name: 'Apply', exact: true }).click();
  await mobilePage.getByRole('heading', { name: 'Apply for Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  await mobilePage.getByRole('button', { name: 'Back to job' }).click();
  await mobilePage.getByRole('button', { name: 'Back to jobs' }).click();
  await mobilePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  await mobilePage.goto(`http://127.0.0.1:${webPort}/?view=saved-jobs`, { waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('button', { name: 'Remove', exact: true }).click();
  await mobilePage.getByText('No saved jobs yet.', { exact: true }).waitFor({ timeout: 20000 });
  const removedSavedJob = await admin.from('candidate_saved_jobs').select('id').eq('candidate_user_id', users[0].id).eq('job_id', jobId);
  assert(!removedSavedJob.error && removedSavedJob.data.length === 0, 'Removing a saved job did not persist its deletion.');

  await mobilePage.goto(`http://127.0.0.1:${webPort}/?view=apply&job=${jobId}`, { waitUntil: 'domcontentloaded' });
  try {
    await mobilePage.getByRole('heading', { name: 'Apply for Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  } catch (error) {
    throw new Error(`Application route failed to render for ${mobilePage.url()}: ${(await mobilePage.locator('body').innerText()).slice(0, 1600)}; browser diagnostics: ${browserErrors.join(' | ')}; network: ${networkDiagnostics.join(' | ')}`, { cause: error });
  }
  await mobilePage.getByRole('button', { name: 'Back to job' }).click();
  await mobilePage.getByRole('heading', { name: 'Senior Systems Engineer' }).waitFor({ timeout: 20000 });
  assert(new URL(mobilePage.url()).searchParams.get('view') === 'job-details', 'Back to job did not cancel the application route safely.');
  await mobilePage.getByRole('button', { name: 'Apply', exact: true }).click();
  await mobilePage.getByRole('heading', { name: 'Apply for Senior Systems Engineer' }).waitFor();
  await mobilePage.getByLabel(/Full legal name/).fill('');
  await mobilePage.getByRole('button', { name: 'Continue' }).click();
  assert((await mobilePage.getByRole('alert').innerText()).includes('Enter your full legal name'), 'Missing legal name was not validated in the application form.');
  await mobilePage.getByLabel(/Full legal name/).fill('Candidate A Application Name');
  await mobilePage.getByLabel('Contact phone').fill('+8801711223344');
  await mobilePage.getByRole('button', { name: 'Continue' }).click();
  await mobilePage.getByRole('heading', { name: 'CV selection' }).waitFor();
  await mobilePage.getByRole('button', { name: 'Continue' }).click();
  assert((await mobilePage.getByRole('alert').innerText()).includes('Create or select a saved CV'), 'Missing saved CV was not validated in the application form.');
  await mobilePage.getByPlaceholder('CV title').fill('C1 application CV');
  await mobilePage.getByRole('button', { name: 'Create' }).click();
  await mobilePage.locator('select option').filter({ hasText: 'C1 application CV' }).waitFor({ state: 'attached' });
  const cvRow = await admin.from('candidate_cvs').select('id,document_url').eq('candidate_user_id', users[0].id).single();
  assert(!cvRow.error && cvRow.data.document_url === null, 'Structured CV did not persist as a record without a fabricated file URL.');
  await mobilePage.getByRole('button', { name: 'Continue' }).click();
  await mobilePage.getByRole('heading', { name: 'Screening questions and introduction' }).waitFor();
  await mobilePage.getByLabel(/Describe a privacy control you have implemented/).fill('I use least-privilege row policies.');
  await mobilePage.getByLabel('Cover letter (optional)').fill('I am interested in this role.');
  assert(await mobilePage.getByText('No supporting documents are saved yet. Upload any documents required by this vacancy below.').count() === 1,
    'Empty supporting-document state was not shown for a candidate with no saved files.');
  await mobilePage.getByRole('button', { name: 'Continue' }).click();
  assert((await mobilePage.getByRole('alert').innerText()).includes('Choose a verified document for: Degree certificate'),
    'Missing required supporting document was not validated before review.');
  const missingScreening = await users[0].client.rpc('candidate_apply_to_job', {
    p_job_id: jobId,
    p_payload: {
      selected_cv_id: cvRow.data.id,
      answers: [],
      declarations: { accuracyCertified: true, recruitmentDataConsent: true },
      document_ids: [], required_document_map: {},
    },
  });
  assert(missingScreening.error?.code === '22000', `Backend did not reject missing required screening: ${JSON.stringify(missingScreening.error)}`);

  await mobilePage.getByLabel('Document title').fill('Degree certificate');
  await mobilePage.getByLabel('PDF or Word file').setInputFiles({
    name: 'unsupported.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('not a document'),
  });
  await mobilePage.getByRole('button', { name: 'Upload document' }).click();
  assert((await mobilePage.getByRole('alert').innerText()).includes('Upload a PDF or Word document'), 'Unsupported document type did not recover through the visible error state.');
  await mobilePage.getByLabel('PDF or Word file').setInputFiles({
    name: 'degree.pdf', mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% local acceptance fixture\n%%EOF\n'),
  });
  await mobilePage.getByRole('button', { name: 'Upload document' }).click();
  const uploadStatus = mobilePage.getByRole('status').filter({ hasText: 'Supporting document uploaded to your private candidate storage.' });
  const uploadAlert = mobilePage.getByRole('alert');
  await Promise.race([uploadStatus.waitFor({ timeout: 20000 }), uploadAlert.waitFor({ timeout: 20000 })]);
  if (await uploadAlert.count()) throw new Error(`Supporting document upload failed: ${(await uploadAlert.first().innerText()).slice(0, 500)}`);
  const profileWithDocument = await admin.from('candidate_profiles').select('profile_data').eq('user_id', users[0].id).single();
  const registeredDocument = profileWithDocument.data?.profile_data?.documents?.[0];
  assert(!profileWithDocument.error && registeredDocument?.id && registeredDocument.fileUrl.startsWith(`${users[0].id}/application-documents/`), 'Uploaded private object did not receive candidate-owned metadata.');
  const storedObjects = await admin.storage.from('candidate-documents').list(`${users[0].id}/application-documents`);
  assert(!storedObjects.error && storedObjects.data.some(file => file.name === registeredDocument.fileUrl.split('/').at(-1)), 'Supporting document did not persist in the private Storage bucket.');
  const requiredDocument = mobilePage.getByLabel(/Degree certificate/).first();
  await requiredDocument.selectOption(registeredDocument.id);

  await mobilePage.getByRole('button', { name: 'Save draft' }).click();
  await mobilePage.getByRole('status').filter({ hasText: 'Your application draft was saved securely.' }).waitFor();
  const aDraft = await admin.from('candidate_application_drafts').select('draft_data,current_step').eq('candidate_user_id', users[0].id).eq('job_id', jobId).single();
  assert(!aDraft.error && aDraft.data.current_step === 3 && aDraft.data.draft_data.documentIds.includes(registeredDocument.id)
    && aDraft.data.draft_data.requiredDocumentMap['Degree certificate'] === registeredDocument.id,
  'Draft did not persist its required supporting document choice to local Postgres.');
  const bCannotReadDraft = await users[1].client.from('candidate_application_drafts').select('id').eq('candidate_user_id', users[0].id);
  const bCannotReadCv = await users[1].client.from('candidate_cvs').select('id').eq('candidate_user_id', users[0].id);
  assert(!bCannotReadDraft.error && bCannotReadDraft.data.length === 0, 'Candidate B could read Candidate A application drafts.');
  assert(!bCannotReadCv.error && bCannotReadCv.data.length === 0, 'Candidate B could read Candidate A CV records.');
  const bUsesForeignCv = await users[1].client.rpc('candidate_apply_to_job', {
    p_job_id: jobId,
    p_payload: {
      selected_cv_id: cvRow.data.id, answers: [{ questionId: 'privacy-experience', answer: 'x' }],
      declarations: { accuracyCertified: true, recruitmentDataConsent: true }, document_ids: [], required_document_map: {},
    },
  });
  assert(bUsesForeignCv.error?.code === '23503', `Candidate B was not denied when applying with Candidate A's CV: ${JSON.stringify(bUsesForeignCv.error)}`);
  const bUsesForeignDocument = await users[1].client.rpc('candidate_add_application_document', {
    p_title: 'Forged document', p_file_name: 'degree.pdf', p_file_path: `${users[0].id}/application-documents/forged.pdf`, p_content_type: 'application/pdf',
  });
  assert(bUsesForeignDocument.error?.code === '42501', `Candidate B was not denied when registering Candidate A's document: ${JSON.stringify(bUsesForeignDocument.error)}`);
  const wrongTenant = await users[1].client.rpc('candidate_apply_to_job', {
    p_job_id: otherTenantJobId,
    p_payload: { selected_cv_id: cvRow.data.id, answers: [], declarations: { accuracyCertified: true, recruitmentDataConsent: true } },
  });
  assert(wrongTenant.error?.code === 'P0002', `Application RPC accepted a job outside the configured recruitment tenant: ${JSON.stringify(wrongTenant.error)}`);
  const anonymousCall = await anon.rpc('candidate_apply_to_job', { p_job_id: jobId, p_payload: {} });
  assert(Boolean(anonymousCall.error), 'Anonymous execution of the application RPC was not denied.');

  await mobilePage.reload({ waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('heading', { name: 'Screening questions and introduction' }).waitFor({ timeout: 20000 });
  assert(await mobilePage.getByLabel(/Describe a privacy control you have implemented/).inputValue() === 'I use least-privilege row policies.', 'Application screening answers did not recover after refresh.');
  assert(await mobilePage.getByLabel('Cover letter (optional)').inputValue() === 'I am interested in this role.', 'Application cover letter did not recover after refresh.');
  assert(await mobilePage.getByLabel(/Describe a privacy control you have implemented/).inputValue() === 'I use least-privilege row policies.', 'Application answer did not recover after refresh.');
  await mobilePage.getByLabel(/Degree certificate/).first().waitFor();
  assert(await mobilePage.getByLabel(/Degree certificate/).first().inputValue() === registeredDocument.id, 'Required document selection did not recover after refresh.');
  assert(!(await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile application form overflows the viewport.');
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await desktop.newPage();
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: users[0].session,
  });
  await page.goto(`http://127.0.0.1:${webPort}/?view=apply&job=${jobId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Screening questions and introduction' }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Previous' }).click();
  await page.getByRole('button', { name: 'Previous' }).click();
  await page.getByLabel(/Full legal name/).fill('Candidate A Application Name');
  await page.getByLabel('Contact phone').fill('+8801711223344');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/certify that the information supplied is complete and accurate/).check();
  await page.getByLabel(/consent to processing this information for recruitment/).check();
  await page.getByRole('button', { name: 'Submit application' }).click();
  await page.waitForTimeout(1500);
  const trackingHeading = page.getByRole('heading', { name: 'My Applications' });
  if (!(await trackingHeading.count())) {
    throw new Error(`Submission did not reach application tracking. Current page: ${(await page.locator('body').innerText()).slice(0, 1200)}`);
  }
  assert(await page.getByText('Senior Systems Engineer').count() > 0, 'Candidate did not reach the shared application tracking page.');

  const applications = await admin.from('job_applications').select('*').eq('job_id', jobId).eq('candidate_user_id', users[0].id);
  assert(!applications.error && applications.data.length === 1, `Application did not persist exactly once: ${JSON.stringify(applications.error)}`);
  const application = applications.data[0];
  assert(application.full_name === 'Candidate A Application Name' && application.phone === '+8801711223344', 'Application contact details did not persist.');
  assert(application.cv_url === null, 'Structured CV submission included an unverified file URL.');
  assert(application.application_data.document_ids.length === 1
    && application.application_data.document_ids[0] === registeredDocument.id
    && application.application_data.required_document_map['Degree certificate'] === registeredDocument.id,
  'Required supporting document was not linked into the submitted application.');
  assert(application.application_data.answers.some(answer => answer.questionId === 'privacy-experience'), 'Screening answer was not stored in the HRIS application row.');
  const submittedContext = await users[0].client.rpc('candidate_get_recruitment_context');
  const submittedApplication = submittedContext.data?.applications?.find(row => row.id === application.id);
  assert(!submittedContext.error && submittedApplication?.stage_history?.length === 1
    && submittedApplication.stage_history[0].stage === 'applied'
    && submittedApplication.stage_history[0].actor_type === 'candidate'
    && !Object.hasOwn(submittedApplication.stage_history[0], 'actor_user_id'),
  `Initial candidate submission history did not persist as a candidate-safe event: ${JSON.stringify(submittedContext.error || submittedApplication?.stage_history)}`);
  const applicationStageArgs = { p_tenant_id: tenantA, p_application_id: application.id };
  const viewOnlyStage = await staff[1].client.rpc('hris_update_candidate_application_stage', { ...applicationStageArgs, p_stage: 'under_review' });
  const crossTenantStage = await staff[2].client.rpc('hris_update_candidate_application_stage', { ...applicationStageArgs, p_stage: 'under_review' });
  const candidateStage = await users[0].client.rpc('hris_update_candidate_application_stage', { ...applicationStageArgs, p_stage: 'under_review' });
  assert(viewOnlyStage.error?.code === '42501' && crossTenantStage.error?.code === '42501' && candidateStage.error?.code === '42501',
    'Candidate review stages were mutable by a viewer, another tenant, or the candidate.');
  const movedToReview = await staff[0].client.rpc('hris_update_candidate_application_stage', { ...applicationStageArgs, p_stage: 'under_review' });
  const movedToScreening = await staff[0].client.rpc('hris_update_candidate_application_stage', { ...applicationStageArgs, p_stage: 'screening' });
  const repeatedScreening = await staff[0].client.rpc('hris_update_candidate_application_stage', { ...applicationStageArgs, p_stage: 'screening' });
  assert(!movedToReview.error && movedToReview.data?.stage === 'under_review' && movedToReview.data?.changed === true
    && !movedToScreening.error && movedToScreening.data?.stage === 'screening' && movedToScreening.data?.changed === true
    && !repeatedScreening.error && repeatedScreening.data?.changed === false,
  `Recruiter review/screening transitions failed or duplicated on retry: ${JSON.stringify(movedToReview.error || movedToScreening.error || repeatedScreening.error)}`);
  const screeningContext = await users[0].client.rpc('candidate_get_recruitment_context');
  const screeningApplication = screeningContext.data?.applications?.find(row => row.id === application.id);
  assert(!screeningContext.error && screeningApplication?.stage === 'screening'
    && screeningApplication.stage_history?.length === 3
    && screeningApplication.stage_history.map(row => row.stage).join(',') === 'applied,under_review,screening'
    && screeningApplication.stage_history.every(row => !Object.hasOwn(row, 'actor_user_id'))
    && !JSON.stringify(screeningApplication.stage_history).includes('Application moved to screening.'),
  `Candidate did not receive persisted review stages without recruiter identity or internal notes: ${JSON.stringify(screeningContext.error || screeningApplication?.stage_history)}`);
  await page.getByText('Application History', { exact: true }).waitFor();
  await page.getByRole('region', { name: 'Application history' }).getByText('Application Submitted', { exact: true }).waitFor();
  const initialApplicationTimeline = await page.locator('body').innerText();
  assert(!initialApplicationTimeline.includes('Application Screening')
    && !initialApplicationTimeline.includes('Verified qualification criteria & resume mapping'),
  'The candidate timeline displayed unverified screening milestones.');
  const draftAfterSubmit = await admin.from('candidate_application_drafts').select('id').eq('candidate_user_id', users[0].id).eq('job_id', jobId);
  assert(!draftAfterSubmit.error && draftAfterSubmit.data.length === 0, 'Successful submission did not clear the candidate draft.');
  const duplicate = await users[0].client.rpc('candidate_apply_to_job', {
    p_job_id: jobId,
    p_payload: {
      selected_cv_id: cvRow.data.id, answers: [{ questionId: 'privacy-experience', answer: 'again' }],
      declarations: { accuracyCertified: true, recruitmentDataConsent: true },
      document_ids: [registeredDocument.id], required_document_map: { 'Degree certificate': registeredDocument.id },
    },
  });
  assert(duplicate.error?.code === '23505', `Duplicate application was not denied by Postgres: ${JSON.stringify(duplicate.error)}`);

  const issueArguments = {
    p_tenant_id: tenantA,
    p_application_id: application.id,
    p_salary_amount: 165000,
    p_salary_currency: 'BDT',
    p_pay_period: 'monthly',
    p_proposed_joining_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    p_response_deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    p_terms: 'Role: Senior Systems Engineer\nOffer source: employer-entered local acceptance terms.',
  };
  const assessmentArguments = {
    p_tenant_id: tenantA,
    p_application_id: application.id,
    p_title: 'Systems Design Exercise',
    p_assessment_type: 'Technical',
    p_instructions: 'Describe the system design and submit your implementation notes or repository link.',
    p_deadline_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  };
  const interviewArguments = {
    p_tenant_id: tenantA,
    p_application_id: application.id,
    p_round_name: 'Technical Systems Interview',
    p_format: 'Video Call',
    p_scheduled_at: organizationDateTime(3),
    p_duration_minutes: 45,
    p_location_or_link: 'https://meet.example.test/hris-candidate-acceptance',
    p_panel_members: ['Panel Member One', 'Panel Member Two'],
    p_instructions: 'Join five minutes before the scheduled time.',
  };
  const viewerSchedule = await staff[1].client.rpc('hris_schedule_candidate_interview', interviewArguments);
  assert(viewerSchedule.error?.code === '42501', 'Recruitment viewer scheduled an interview.');
  const foreignTenantSchedule = await staff[2].client.rpc('hris_schedule_candidate_interview', interviewArguments);
  assert(foreignTenantSchedule.error?.code === '42501', 'Another tenant’s manager scheduled an interview for this application.');
  const invalidInterviewSchedule = await staff[0].client.rpc('hris_schedule_candidate_interview', { ...interviewArguments, p_duration_minutes: 0 });
  assert(invalidInterviewSchedule.error?.code === '22023', 'Backend accepted an invalid interview duration.');
  const anonymousSchedule = await anon.rpc('hris_schedule_candidate_interview', interviewArguments);
  assert(anonymousSchedule.error?.code === '42501', 'Anonymous caller scheduled a candidate interview.');
  const viewerIssue = await staff[1].client.rpc('hris_issue_candidate_offer', issueArguments);
  assert(viewerIssue.error?.code === '42501', `Recruitment viewer issued an offer: ${JSON.stringify(viewerIssue.error)}`);
  const foreignTenantIssue = await staff[2].client.rpc('hris_issue_candidate_offer', issueArguments);
  assert(foreignTenantIssue.error?.code === '42501', `Another tenant’s manager issued this offer: ${JSON.stringify(foreignTenantIssue.error)}`);
  const invalidOfferAmount = await staff[0].client.rpc('hris_issue_candidate_offer', { ...issueArguments, p_salary_amount: 0 });
  assert(invalidOfferAmount.error?.code === '22023', `Backend accepted a non-positive offer amount: ${JSON.stringify(invalidOfferAmount.error)}`);
  const directOfferWrite = await staff[0].client.from('job_offers').insert({
    application_id: application.id, offered_title: 'Unauthorized direct write',
    salary_amount: 1, salary_currency: 'BDT', status: 'issued',
  });
  assert(directOfferWrite.error?.code === '42501', 'Recruitment manager bypassed the offer issue RPC through direct table access.');
  const viewerAssessmentAssignment = await staff[1].client.rpc('hris_assign_candidate_assessment', assessmentArguments);
  assert(viewerAssessmentAssignment.error?.code === '42501', 'Recruitment viewer assigned a candidate assessment.');
  const foreignTenantAssessmentAssignment = await staff[2].client.rpc('hris_assign_candidate_assessment', assessmentArguments);
  assert(foreignTenantAssessmentAssignment.error?.code === '42501', 'Tenant B manager assigned an assessment to Tenant A.');
  const candidateAssessmentAssignment = await users[0].client.rpc('hris_assign_candidate_assessment', assessmentArguments);
  assert(candidateAssessmentAssignment.error?.code === '42501', 'Candidate was allowed to issue a recruiter assessment.');
  const anonymousAssessmentAssignment = await anon.rpc('hris_assign_candidate_assessment', assessmentArguments);
  assert(anonymousAssessmentAssignment.error?.code === '42501', 'Anonymous caller assigned a candidate assessment.');
  const invalidAssessment = await staff[0].client.rpc('hris_assign_candidate_assessment', {
    ...assessmentArguments, p_title: ' ', p_deadline_date: '2000-01-01',
  });
  assert(invalidAssessment.error?.code === '22023', 'Backend accepted invalid candidate assessment details.');
  const viewerAssessmentQueue = await staff[1].client.rpc('hris_get_candidate_assessments', { p_tenant_id: tenantA });
  assert(viewerAssessmentQueue.error?.code === '42501', 'Recruitment viewer read candidate assessment submissions.');
  const foreignAssessmentQueue = await staff[2].client.rpc('hris_get_candidate_assessments', { p_tenant_id: tenantA });
  assert(foreignAssessmentQueue.error?.code === '42501', 'Tenant B manager read Tenant A candidate assessments.');

  const mainManager = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mainManagerPage = await mainManager.newPage();
  mainManagerPage.on('pageerror', error => browserErrors.push(error.message));
  const mainDiagnostics = [];
  const offerIssueResponses = [];
  const assessmentAssignmentResponses = [];
  mainManagerPage.on('console', message => { if (message.type() === 'error') mainDiagnostics.push(message.text()); });
  mainManagerPage.on('response', async response => {
    if (response.status() >= 400) mainDiagnostics.push(`${response.status()} ${response.url()}`);
    if (response.url().includes('hris_issue_candidate_offer')) offerIssueResponses.push({ status: response.status(), body: (await response.text()).slice(0, 1000) });
    if (response.url().includes('hris_assign_candidate_assessment')) assessmentAssignmentResponses.push({ status: response.status(), body: (await response.text()).slice(0, 1000) });
  });
  await mainManagerPage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: staff[0].session,
  });
  await mainManagerPage.goto(`http://127.0.0.1:${mainPort}/`, { waitUntil: 'domcontentloaded' });
  try { await mainManagerPage.getByRole('heading', { name: 'Candidate pipeline' }).waitFor({ timeout: 10000 }); }
  catch { throw new Error(`Main HR manager UI did not reach recruitment. UI=${(await mainManagerPage.locator('body').innerText()).slice(0, 2400)} diagnostics=${mainDiagnostics.join(';') || browserErrors.join(';') || 'none'}`); }
  await mainManagerPage.getByRole('heading', { name: 'Applications' }).waitFor();
  const candidateApplicationRow = mainManagerPage.getByRole('listitem').filter({ hasText: 'Candidate A Application Name' }).first();
  await candidateApplicationRow.getByText('Assign assessment', { exact: true }).click();
  assert(await candidateApplicationRow.locator('form').last().evaluate(form => !form.checkValidity()), 'Assessment assignment form did not require title, type, instructions, and due date.');
  await candidateApplicationRow.getByLabel('Assessment title for Candidate A Application Name').fill(assessmentArguments.p_title);
  await candidateApplicationRow.getByLabel('Assessment type for Candidate A Application Name').fill(assessmentArguments.p_assessment_type);
  await candidateApplicationRow.getByLabel('Assessment instructions for Candidate A Application Name').fill(assessmentArguments.p_instructions);
  await candidateApplicationRow.getByLabel('Assessment due date for Candidate A Application Name').fill(assessmentArguments.p_deadline_date);
  await candidateApplicationRow.getByRole('button', { name: 'Assign to candidate' }).click();
  try { await candidateApplicationRow.getByRole('status').filter({ hasText: 'Assessment assigned to Candidate A Application Name.' }).waitFor({ timeout: 20000 }); }
  catch { throw new Error(`Assessment assignment did not complete. Row=${(await candidateApplicationRow.innerText()).slice(0, 1500)} response=${JSON.stringify(assessmentAssignmentResponses)} diagnostics=${mainDiagnostics.join(';') || browserErrors.join(';') || 'none'}`); }
  const assignedAssessment = await admin.from('candidate_assessments').select('id,application_id,title,assessment_type,instructions,deadline_date,status,created_by').eq('application_id', application.id).single();
  assert(!assignedAssessment.error && assignedAssessment.data.title === assessmentArguments.p_title
    && assignedAssessment.data.assessment_type === assessmentArguments.p_assessment_type
    && assignedAssessment.data.deadline_date === assessmentArguments.p_deadline_date
    && assignedAssessment.data.status === 'pending' && assignedAssessment.data.created_by === staff[0].id,
  `Recruiter assessment did not persist with entered values: ${JSON.stringify(assignedAssessment.error || assignedAssessment.data)}`);
  const managerAssessmentRead = await staff[0].client.from('candidate_assessments').select('id').eq('id', assignedAssessment.data.id);
  assert(managerAssessmentRead.error?.code === '42501', 'Recruiter bypassed the tenant assessment queue with a direct table read.');
  const candidateAssessmentRead = await users[0].client.from('candidate_assessments').select('id').eq('id', assignedAssessment.data.id);
  assert(candidateAssessmentRead.error?.code === '42501', 'Candidate bypassed the owner-scoped assessment context with a direct table read.');
  const candidateBContext = await users[1].client.rpc('candidate_get_recruitment_context');
  assert(!candidateBContext.error && (candidateBContext.data.assessments || []).length === 0
    && !(candidateBContext.data.applications || []).some(row => row.id === application.id),
  'Candidate B received Candidate A application or assessment history in their owner-scoped context.');
  const candidateBCrossSubmit = await users[1].client.rpc('candidate_submit_assessment', {
    p_assessment_id: assignedAssessment.data.id, p_payload: { submission_text: 'cross-tenant attempt' },
  });
  assert(candidateBCrossSubmit.error?.code === 'P0002', 'Candidate B submitted Candidate A’s assessment.');
  const insecureCandidateSubmission = await users[0].client.rpc('candidate_submit_assessment', {
    p_assessment_id: assignedAssessment.data.id, p_payload: { submission_text: 'work', file_url: 'javascript:alert(1)' },
  });
  assert(insecureCandidateSubmission.error?.code === '22023', 'Candidate assessment RPC accepted a non-HTTPS submission link.');
  const ownerReviewAttempt = await users[0].client.rpc('hris_review_candidate_assessment', {
    p_tenant_id: tenantA, p_assessment_id: assignedAssessment.data.id, p_review_note: null,
  });
  assert(ownerReviewAttempt.error?.code === '42501', 'Candidate marked their own assessment as reviewed.');
  const viewerReviewAttempt = await staff[1].client.rpc('hris_review_candidate_assessment', {
    p_tenant_id: tenantA, p_assessment_id: assignedAssessment.data.id, p_review_note: null,
  });
  assert(viewerReviewAttempt.error?.code === '42501', 'Recruitment viewer marked a candidate assessment reviewed.');
  const foreignReviewAttempt = await staff[2].client.rpc('hris_review_candidate_assessment', {
    p_tenant_id: tenantA, p_assessment_id: assignedAssessment.data.id, p_review_note: null,
  });
  assert(foreignReviewAttempt.error?.code === '42501', 'Tenant B manager reviewed a Tenant A assessment.');
  const candidateAssessmentContext = await users[0].client.rpc('candidate_get_recruitment_context');
  assert(!candidateAssessmentContext.error && candidateAssessmentContext.data.assessments.length === 1
    && candidateAssessmentContext.data.assessments[0].id === assignedAssessment.data.id
    && !Object.hasOwn(candidateAssessmentContext.data.assessments[0], 'review_note')
    && !Object.hasOwn(candidateAssessmentContext.data.assessments[0], 'reviewed_by')
    && !Object.hasOwn(candidateAssessmentContext.data.assessments[0], 'created_by'),
  'Candidate assessment context did not return only the candidate-owned assignment and public fields.');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`http://127.0.0.1:${webPort}/?view=tasks`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Assessments & Document Requests' }).waitFor({ timeout: 20000 });
  await page.getByRole('heading', { name: assessmentArguments.p_title }).waitFor({ timeout: 20000 });
  await page.getByText(/Describe the system design and submit your implementation notes or repository link/).waitFor();
  const candidateAssessmentHeader = page.getByRole('heading', { name: assessmentArguments.p_title }).locator('xpath=..');
  const candidateAssessmentHeaderText = await candidateAssessmentHeader.innerText();
  assert(candidateAssessmentHeaderText.includes('Technical'), `Candidate assessment type was not adapted from the persisted row. Header=${candidateAssessmentHeaderText}`);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile candidate assessment task overflows the viewport.');
  await page.getByRole('button', { name: 'Submit Assessment Work' }).click();
  await page.getByRole('heading', { name: `Submit Assessment: ${assessmentArguments.p_title}` }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert(await page.getByRole('heading', { name: `Submit Assessment: ${assessmentArguments.p_title}` }).count() === 0, 'Candidate could not cancel assessment submission.');
  await page.getByRole('button', { name: 'Submit Assessment Work' }).click();
  await page.getByRole('button', { name: 'Submit to Synesis Committee' }).click();
  assert((await page.getByRole('alert').innerText()).includes('Please provide written submission notes'), 'Assessment submission accepted an empty response or did not show validation.');
  await page.getByPlaceholder(/Provide architecture choices/).fill('I compared a normalized relational model with a small event stream and documented the trade-offs.');
  await page.getByPlaceholder('https://github.com/your-username/assessment-solution').fill('https://github.com/candidate/systems-design-exercise');
  await page.getByRole('button', { name: 'Submit to Synesis Committee' }).click();
  await page.getByText('Submitted for Review', { exact: true }).waitFor({ timeout: 20000 });
  assert(await page.getByText(/normalized relational model with a small event stream/).count() === 1,
    'Candidate submission work was not visible after persistence.');
  const persistedCandidateAssessment = await admin.from('candidate_assessments').select('status,submission_data,submitted_at').eq('id', assignedAssessment.data.id).single();
  assert(!persistedCandidateAssessment.error && persistedCandidateAssessment.data.status === 'submitted'
    && persistedCandidateAssessment.data.submission_data.file_url === 'https://github.com/candidate/systems-design-exercise'
    && persistedCandidateAssessment.data.submitted_at,
  `Candidate assessment work did not persist: ${JSON.stringify(persistedCandidateAssessment.error || persistedCandidateAssessment.data)}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: assessmentArguments.p_title }).waitFor({ timeout: 20000 });
  await page.getByText('Submitted for Review', { exact: true }).waitFor();
  const tenantAAssessmentQueue = await staff[0].client.rpc('hris_get_candidate_assessments', { p_tenant_id: tenantA });
  assert(!tenantAAssessmentQueue.error && tenantAAssessmentQueue.data.length === 1
    && tenantAAssessmentQueue.data[0].id === assignedAssessment.data.id
    && tenantAAssessmentQueue.data[0].submission_data.submission_text.includes('normalized relational model'),
  'Tenant A manager did not receive the submitted assessment in the authorized review queue.');
  await mainManagerPage.getByRole('heading', { name: 'Candidate assessments' }).waitFor({ timeout: 20000 });
  const assessmentQueueSection = mainManagerPage.locator('section[aria-labelledby="candidate-assessments-heading"]');
  await assessmentQueueSection.getByRole('button', { name: 'Refresh candidate assessments' }).click();
  await assessmentQueueSection.getByText('Submitted for review', { exact: true }).waitFor({ timeout: 20000 });
  await assessmentQueueSection.getByText(assessmentArguments.p_title, { exact: true }).waitFor({ timeout: 20000 });
  await assessmentQueueSection.getByText(/normalized relational model/).waitFor();
  await assessmentQueueSection.getByRole('link', { name: 'systems-design-exercise' }).waitFor();
  await assessmentQueueSection.getByRole('button', { name: 'Mark review complete' }).click();
  await assessmentQueueSection.getByText('Review complete', { exact: true }).waitFor({ timeout: 20000 });
  const reviewedAssessment = await admin.from('candidate_assessments').select('status,reviewed_by,reviewed_at,review_note').eq('id', assignedAssessment.data.id).single();
  assert(!reviewedAssessment.error && reviewedAssessment.data.status === 'reviewed'
    && reviewedAssessment.data.reviewed_by === staff[0].id && reviewedAssessment.data.reviewed_at && reviewedAssessment.data.review_note === null,
  `Recruiter review state did not persist without inventing a score or note: ${JSON.stringify(reviewedAssessment.error || reviewedAssessment.data)}`);
  const duplicateReview = await staff[0].client.rpc('hris_review_candidate_assessment', {
    p_tenant_id: tenantA, p_assessment_id: assignedAssessment.data.id, p_review_note: null,
  });
  assert(duplicateReview.error?.code === 'P0002', 'A second review overwrote the completed assessment review.');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: assessmentArguments.p_title }).waitFor({ timeout: 20000 });
  await page.getByText('Review Complete', { exact: true }).waitFor();
  const reviewedCandidateContext = await users[0].client.rpc('candidate_get_recruitment_context');
  const candidateReviewRecord = reviewedCandidateContext.data?.assessments?.[0];
  assert(!reviewedCandidateContext.error && candidateReviewRecord?.status === 'reviewed'
    && candidateReviewRecord.reviewed_at === reviewedAssessment.data.reviewed_at
    && !Object.hasOwn(candidateReviewRecord, 'review_note') && !Object.hasOwn(candidateReviewRecord, 'reviewed_by'),
  'Candidate did not recover the review completion state or received private review metadata.');
  await mainManagerPage.getByText('Schedule interview', { exact: true }).click();
  assert(await mainManagerPage.locator('form').last().evaluate(form => !form.checkValidity()), 'Interview schedule form did not require its round, date, and duration.');
  await mainManagerPage.getByLabel('Interview round').fill(interviewArguments.p_round_name);
  await mainManagerPage.getByLabel('Interview format').selectOption(interviewArguments.p_format);
  await mainManagerPage.getByLabel('Interview date and time (organization time zone)').fill(interviewArguments.p_scheduled_at);
  await mainManagerPage.getByLabel('Interview duration in minutes').fill(String(interviewArguments.p_duration_minutes));
  await mainManagerPage.getByLabel('Secure meeting link').fill(interviewArguments.p_location_or_link);
  await mainManagerPage.getByLabel('Panel members').fill(interviewArguments.p_panel_members.join(', '));
  await mainManagerPage.getByLabel('Candidate instructions').fill(interviewArguments.p_instructions);
  await mainManagerPage.getByRole('button', { name: 'Send interview invitation' }).click();
  try { await mainManagerPage.getByRole('status').filter({ hasText: 'Interview invitation scheduled.' }).waitFor({ timeout: 20000 }); }
  catch { throw new Error(`Interview scheduling failed. UI=${(await mainManagerPage.locator('body').innerText()).slice(0, 2200)} diagnostics=${mainDiagnostics.join(';') || 'none'}`); }
  const scheduledInterview = await admin.from('interviews').select('id,status,interview_type,scheduled_at,duration_minutes,panel_members,location_or_link,timezone').eq('application_id', application.id).eq('status', 'scheduled').single();
  assert(!scheduledInterview.error && scheduledInterview.data.status === 'scheduled'
    && scheduledInterview.data.interview_type === 'Technical Systems Interview — Video Call'
    && scheduledInterview.data.duration_minutes === 45 && scheduledInterview.data.panel_members.length === 2
    && scheduledInterview.data.timezone === 'Asia/Dhaka'
    && new Date(scheduledInterview.data.scheduled_at).toLocaleString('sv-SE', { timeZone: scheduledInterview.data.timezone }).replace(' ', 'T').slice(0, 16) === interviewArguments.p_scheduled_at,
  `Manager interview details did not persist: ${JSON.stringify(scheduledInterview.error || scheduledInterview.data)}`);
  const foreignInterview = await admin.from('interviews').insert({
    id: randomUUID(), application_id: foreignApplicationId,
    scheduled_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    interview_type: 'Cross-tenant authorization fixture — Video Call',
    location_or_link: 'https://meet.example.test/cross-tenant-fixture',
    status: 'scheduled', created_by: staff[2].id, candidate_response: 'invited',
    duration_minutes: 30, timezone: 'Asia/Dhaka', panel_members: [], instructions: null,
  }).select('id').single();
  assert(!foreignInterview.error, `Could not prepare the isolated cross-candidate authorization fixture: ${JSON.stringify(foreignInterview.error)}`);
  const crossCandidateResponse = await users[0].client.rpc('candidate_respond_interview', {
    p_interview_id: foreignInterview.data.id, p_response: 'confirmed', p_reason: null, p_proposed_times: null,
  });
  assert(crossCandidateResponse.error?.code === 'P0002', 'Candidate A responded to Candidate B’s tenant interview.');
  const candidateCannotSchedule = await users[0].client.rpc('hris_schedule_candidate_interview', interviewArguments);
  assert(candidateCannotSchedule.error?.code === '42501', 'Candidate was allowed to schedule an HR interview.');
  const directInterviewRead = await users[0].client.from('interviews').select('id').eq('id', scheduledInterview.data.id);
  assert(directInterviewRead.error?.code === '42501', 'Candidate bypassed the owner-scoped interview context using direct table access.');
  const viewerResponseQueue = await staff[1].client.rpc('hris_get_candidate_interview_responses', { p_tenant_id: tenantA });
  assert(viewerResponseQueue.error?.code === '42501', 'Recruitment viewer read candidate interview responses.');
  const foreignResponseQueue = await staff[2].client.rpc('hris_get_candidate_interview_responses', { p_tenant_id: tenantA });
  assert(foreignResponseQueue.error?.code === '42501', 'Tenant B manager read Tenant A interview responses.');
  const managerResponseQueue = await staff[0].client.rpc('hris_get_candidate_interview_responses', { p_tenant_id: tenantA });
  assert(!managerResponseQueue.error && managerResponseQueue.data.length === 1
    && managerResponseQueue.data[0].candidate_email === users[0].email,
  'Tenant A manager did not receive only their own scheduled interview response.');
  const managerDirectInterviewRead = await staff[0].client.from('interviews').select('id').eq('id', scheduledInterview.data.id);
  assert(managerDirectInterviewRead.error?.code === '42501', 'Recruiter bypassed the tenant response RPC with a direct table read.');

  await page.close();
  page = await desktop.newPage();
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: users[0].session,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`http://127.0.0.1:${webPort}/?view=interviews`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Interview Invitations' }).waitFor({ timeout: 20000 });
  await page.getByText('Technical Systems Interview', { exact: false }).waitFor();
  assert(await page.getByText('Video Call', { exact: false }).count() > 0, `Candidate did not receive the scheduled interview format. URL=${page.url()} errors=${browserErrors.join(';') || 'none'} UI=${(await page.locator('body').innerText()).slice(0, 2400)}`);
  assert(await page.getByText('Panel Member One, Panel Member Two', { exact: false }).count() > 0, `Candidate did not receive the scheduled interview panel. UI=${(await page.locator('body').innerText()).slice(0, 2400)}`);
  assert(await page.getByText('Asia/Dhaka', { exact: false }).count() > 0, 'Candidate interview time did not disclose the organization time zone.');
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile candidate interview page overflows the viewport.');
  await page.getByRole('button', { name: 'Request Reschedule' }).click();
  try { await page.getByRole('heading', { name: 'Request Alternative Time Slot' }).waitFor({ timeout: 5000 }); }
  catch { throw new Error(`Candidate reschedule dialog did not open. UI=${(await page.locator('body').innerText()).slice(0, 2400)}`); }
  const responseTextboxes = page.getByRole('textbox');
  await responseTextboxes.nth(0).fill('I have an overlapping work commitment.');
  await responseTextboxes.nth(1).fill('Friday 10:00–12:00 Asia/Dhaka');
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile reschedule dialog overflows the viewport.');
  await page.getByRole('button', { name: 'Confirm Response' }).click();
  await page.getByText('Reschedule Requested', { exact: true }).waitFor({ timeout: 20000 });
  const candidateReschedule = await admin.from('interviews').select('candidate_response,candidate_response_note,candidate_proposed_times').eq('id', scheduledInterview.data.id).single();
  assert(!candidateReschedule.error && candidateReschedule.data.candidate_response === 'reschedule_requested'
    && candidateReschedule.data.candidate_proposed_times === 'Friday 10:00–12:00 Asia/Dhaka',
  'Candidate reschedule request did not persist with its proposed availability.');
  const incompleteReschedule = await users[0].client.rpc('candidate_respond_interview', {
    p_interview_id: scheduledInterview.data.id, p_response: 'reschedule_requested', p_reason: null, p_proposed_times: null,
  });
  assert(incompleteReschedule.error?.code === '22023', 'Candidate reschedule request was accepted without reason and proposed times.');
  const duplicateCandidateResponse = await users[0].client.rpc('candidate_respond_interview', {
    p_interview_id: scheduledInterview.data.id, p_response: 'confirmed', p_reason: null, p_proposed_times: null,
  });
  assert(duplicateCandidateResponse.error?.code === 'P0002', 'Candidate changed a submitted response on the same invitation.');
  await mainManagerPage.reload({ waitUntil: 'domcontentloaded' });
  await mainManagerPage.getByRole('heading', { name: 'Interview responses' }).waitFor({ timeout: 20000 });
  await mainManagerPage.getByText('Reschedule requested', { exact: true }).waitFor();
  await mainManagerPage.getByText('Friday 10:00–12:00 Asia/Dhaka', { exact: false }).waitFor();
  await mainManagerPage.locator('section[aria-labelledby="interview-responses-heading"]').getByText(/45 minutes · Asia\/Dhaka/).waitFor();
  await mainManagerPage.getByText('Offer another time', { exact: true }).click();
  await mainManagerPage.getByLabel('Interview round').fill('Technical Systems Interview');
  await mainManagerPage.getByLabel('Interview format').selectOption('Video Call');
  await mainManagerPage.getByLabel('Interview date and time (organization time zone)').fill(organizationDateTime(5));
  await mainManagerPage.getByLabel('Interview duration in minutes').fill('45');
  await mainManagerPage.getByLabel('Secure meeting link').fill('https://meet.example.test/hris-candidate-rescheduled');
  await mainManagerPage.getByLabel('Panel members').fill('Panel Member One, Panel Member Two');
  await mainManagerPage.getByLabel('Candidate instructions').fill('Revised invitation.');
  await mainManagerPage.getByRole('button', { name: 'Send interview invitation' }).click();
  await mainManagerPage.getByText('Interview invitation scheduled.', { exact: false }).waitFor({ timeout: 20000 });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Interview Invitations' }).waitFor({ timeout: 20000 });
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Desktop candidate interview page overflows the viewport.');
  await page.getByText('Rescheduled', { exact: false }).waitFor().catch(() => {});
  await page.getByRole('button', { name: 'Accept Invitation' }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Accept Invitation' }).click();
  await page.getByRole('button', { name: 'Confirm Response' }).click();
  await page.getByText('Confirmed / Accepted', { exact: true }).waitFor({ timeout: 20000 });
  const finalInterviews = await admin.from('interviews').select('status,candidate_response').eq('application_id', application.id).order('created_at');
  assert(!finalInterviews.error && finalInterviews.data.length === 2
    && finalInterviews.data[0].status === 'cancelled'
    && finalInterviews.data[0].candidate_response === 'reschedule_requested'
    && finalInterviews.data[1].status === 'scheduled' && finalInterviews.data[1].candidate_response === 'confirmed',
  `Reschedule history or final candidate acceptance was not persisted: ${JSON.stringify(finalInterviews.error || finalInterviews.data)}`);
  await mainManagerPage.reload({ waitUntil: 'domcontentloaded' });
  await mainManagerPage.getByRole('heading', { name: 'Interview responses' }).waitFor({ timeout: 20000 });
  await mainManagerPage.getByText('Candidate accepted', { exact: true }).waitFor();

  await mainManagerPage.getByText('Issue offer', { exact: true }).click();
  assert(await mainManagerPage.locator('form').last().evaluate(form => !form.checkValidity()), 'Offer form did not enforce required fields before submission.');
  await mainManagerPage.getByLabel('Offer amount').fill('165000');
  await mainManagerPage.getByLabel('Currency code').fill('BDT');
  await mainManagerPage.getByLabel('Pay period').selectOption('monthly');
  await mainManagerPage.getByLabel('Proposed joining date').fill(issueArguments.p_proposed_joining_date);
  await mainManagerPage.getByLabel('Candidate response deadline').fill(issueArguments.p_response_deadline);
  await mainManagerPage.getByLabel('Offer terms').fill(issueArguments.p_terms);
  await mainManagerPage.getByRole('button', { name: 'Issue offer to candidate' }).click();
  try { await mainManagerPage.getByRole('status').filter({ hasText: 'Offer issued to the candidate.' }).waitFor({ timeout: 20000 }); }
  catch { throw new Error(`Offer issue did not complete. UI=${(await mainManagerPage.locator('body').innerText()).slice(0, 2000)} response=${JSON.stringify(offerIssueResponses)} diagnostics=${mainDiagnostics.join(';') || 'none'}`); }
  assert(!(await mainManagerPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile recruiter offer form overflows the viewport.');
  const issuedOffer = await admin.from('job_offers').select('id,status,offered_title,salary_amount,salary_currency,pay_period,proposed_joining_date,response_deadline,terms').eq('application_id', application.id).single();
  assert(!issuedOffer.error && issuedOffer.data.status === 'issued' && issuedOffer.data.offered_title === 'Senior Systems Engineer'
    && issuedOffer.data.salary_amount === 165000 && issuedOffer.data.salary_currency === 'BDT'
    && issuedOffer.data.pay_period === 'monthly' && issuedOffer.data.terms === issueArguments.p_terms,
  `Recruiter offer did not persist its entered terms: ${JSON.stringify(issuedOffer.error || issuedOffer.data)}`);
  const duplicateOffer = await staff[0].client.rpc('hris_issue_candidate_offer', issueArguments);
  assert(duplicateOffer.error?.code === '23505', `A second open offer was not denied: ${JSON.stringify(duplicateOffer.error)}`);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`http://127.0.0.1:${webPort}/?view=applications`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'My Applications' }).waitFor({ timeout: 20000 });
  const mobileHistory = page.getByRole('region', { name: 'Application history' });
  await mobileHistory.getByText('Screening in Progress', { exact: true }).first().waitFor({ timeout: 20000 });
  await mobileHistory.getByText('Interview Scheduled', { exact: true }).first().waitFor({ timeout: 20000 });
  await mobileHistory.getByText('Offer Extended', { exact: true }).first().waitFor({ timeout: 20000 });
  const persistedTimeline = await page.locator('body').innerText();
  assert(!persistedTimeline.includes('private recruiter') && !persistedTimeline.includes('panel note'),
    'Candidate application history exposed internal recruiter notes.');
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile application history overflows the viewport.');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const desktopHistory = page.getByRole('region', { name: 'Application history' });
  await desktopHistory.getByText('Interview Scheduled', { exact: true }).first().waitFor({ timeout: 20000 });
  await desktopHistory.getByText('Offer Extended', { exact: true }).first().waitFor({ timeout: 20000 });
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Desktop application history overflows the viewport.');

  const candidateOfferContexts = [];
  page.on('response', async response => {
    if (!response.url().includes('candidate_get_recruitment_context')) return;
    try {
      const payload = await response.json();
      candidateOfferContexts.push({ status: response.status(), offers: (payload.offers || []).map(offer => ({ id: offer.id, terms: offer.terms })) });
    } catch { candidateOfferContexts.push({ status: response.status(), parseFailed: true }); }
  });
  await page.getByRole('button', { name: 'Offers & Preboarding', exact: true }).click();
  await page.getByRole('heading', { name: 'Employment Offers' }).waitFor({ timeout: 20000 });
  const candidateOfferPageText = await page.locator('body').innerText();
  assert(candidateOfferPageText.includes('Role: Senior Systems Engineer'),
    `Candidate did not see the employer-entered offer terms before responding. Context=${JSON.stringify(candidateOfferContexts)} UI=${candidateOfferPageText.slice(0, 1800)}`);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Desktop candidate offer page overflows the viewport.');
  await page.getByRole('button', { name: 'Accept & Sign Offer', exact: true }).click();
  await page.getByLabel(/Type Legal Full Name/).fill('Candidate A Application Name');
  await page.getByRole('button', { name: 'Confirm & Sign Offer' }).click();
  await page.getByRole('heading', { name: 'Preboarding & Employee Transition' }).waitFor({ timeout: 20000 });
  const acceptedOfferRow = await admin.from('job_offers').select('status,acceptance_signature').eq('application_id', application.id).single();
  assert(!acceptedOfferRow.error && acceptedOfferRow.data.status === 'accepted' && acceptedOfferRow.data.acceptance_signature === 'Candidate A Application Name', 'Candidate offer acceptance and electronic signature did not persist.');
  const generatedHandoff = await admin.from('onboarding_handoffs').select('id,status,application_id').eq('application_id', application.id).single();
  assert(!generatedHandoff.error && generatedHandoff.data.status === 'pending', 'Accepted offer did not create the linked pending preboarding handoff.');

  const preboardingMobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const preboardingPage = await preboardingMobile.newPage();
  preboardingPage.on('pageerror', error => browserErrors.push(error.message));
  const preboardingRpcResponses = [];
  preboardingPage.on('response', async response => {
    if (response.url().includes('candidate_save_my_preboarding_step')) {
      preboardingRpcResponses.push({ status: response.status(), body: (await response.text()).slice(0, 1200) });
    }
  });
  await preboardingPage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: users[0].session,
  });
  await preboardingPage.goto(`http://127.0.0.1:${webPort}/?view=preboarding`, { waitUntil: 'domcontentloaded' });
  await preboardingPage.getByRole('heading', { name: 'Preboarding & Employee Transition' }).waitFor({ timeout: 20000 });
  await preboardingPage.getByRole('button', { name: 'Save Identity Details' }).click();
  try { await preboardingPage.getByRole('alert').waitFor({ timeout: 5000 }); }
  catch { throw new Error(`Missing identity validation response. UI=${(await preboardingPage.locator('body').innerText()).slice(0, 2000)} RPC=${JSON.stringify(preboardingRpcResponses)} browser errors=${browserErrors.join(';') || 'none'}`); }
  assert((await preboardingPage.getByRole('alert').innerText()).includes('Complete each required field'), 'Preboarding accepted an incomplete identity section.');
  await preboardingPage.getByLabel(/National ID/).fill('NID-C1-A-001');
  await preboardingPage.getByLabel(/Date of Birth/).fill('1992-03-14');
  await preboardingPage.getByLabel(/Nationality/).fill('Bangladeshi');
  await preboardingPage.getByLabel(/Permanent Residential Address/).fill('Dhaka, Bangladesh');
  await preboardingPage.getByRole('button', { name: 'Save Identity Details' }).click();
  await preboardingPage.getByText('Preboarding step successfully saved', { exact: false }).waitFor();
  const savedIdentity = await admin.from('onboarding_handoffs').select('candidate_personal_data,candidate_completed_steps').eq('application_id', application.id).single();
  assert(!savedIdentity.error && savedIdentity.data.candidate_personal_data.national_id === 'NID-C1-A-001'
    && savedIdentity.data.candidate_completed_steps.includes('step_identity'), 'Candidate identity section did not persist to the isolated handoff record.');
  await preboardingPage.reload({ waitUntil: 'domcontentloaded' });
  await preboardingPage.getByRole('heading', { name: 'Preboarding & Employee Transition' }).waitFor({ timeout: 20000 });
  assert(await preboardingPage.getByLabel(/National ID/).inputValue() === 'NID-C1-A-001', 'Saved preboarding identity did not recover after refresh.');

  await preboardingPage.getByRole('button', { name: '2. Emergency Contact' }).click();
  await preboardingPage.getByLabel(/Emergency Contact Full Name/).fill('Test Contact A');
  await preboardingPage.getByLabel(/Emergency Contact Phone/).fill('+8801700000001');
  await preboardingPage.getByLabel(/Relationship/).selectOption('Other');
  await preboardingPage.getByRole('button', { name: 'Save Emergency Contact' }).click();
  await preboardingPage.getByText('Preboarding step successfully saved', { exact: false }).waitFor();

  await preboardingPage.getByRole('button', { name: '3. Banking & Tax Info' }).click();
  await preboardingPage.getByRole('button', { name: 'Save Payroll Details' }).click();
  await preboardingPage.getByRole('alert').waitFor();
  assert((await preboardingPage.getByRole('alert').innerText()).includes('Complete each required field'), 'Preboarding accepted an incomplete payroll section.');
  await preboardingPage.getByLabel(/Designated Bank/).fill('C1 Test Bank');
  await preboardingPage.getByLabel(/Bank Account Number/).fill('1234567890');
  await preboardingPage.getByLabel(/Taxpayer Identification Number/).fill('123456789012');
  await preboardingPage.getByRole('button', { name: 'Save Payroll Details' }).click();
  await preboardingPage.getByText('Preboarding step successfully saved', { exact: false }).waitFor();

  await preboardingPage.getByRole('button', { name: '4. Policies & Security' }).click();
  const submitPacket = preboardingPage.getByRole('button', { name: 'Complete & Submit Preboarding Packet' });
  assert(await submitPacket.isDisabled(), 'Preboarding packet could be submitted before policy acknowledgment.');
  await preboardingPage.getByLabel(/I acknowledge that I have read and agree/).check();
  await submitPacket.click();
  await preboardingPage.getByText('Your packet was submitted to HR', { exact: false }).waitFor({ timeout: 20000 });
  assert(!(await preboardingPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile preboarding journey overflows the viewport.');
  const submittedPacket = await admin.from('onboarding_handoffs').select('status,candidate_personal_data,candidate_completed_steps,candidate_submitted_at').eq('application_id', application.id).single();
  assert(!submittedPacket.error && submittedPacket.data.status === 'in_progress' && submittedPacket.data.candidate_submitted_at
    && submittedPacket.data.candidate_completed_steps.length === 4
    && submittedPacket.data.candidate_personal_data.policies_accepted === true
    && submittedPacket.data.candidate_personal_data.bank_account_number === '1234567890', 'Completed four-step packet did not persist with a separate HR handoff submission timestamp.');
  await preboardingPage.getByRole('button', { name: '1. National ID & Passport' }).click();
  assert(await preboardingPage.getByLabel(/National ID/).isDisabled(), 'Submitted preboarding packet remained editable.');

  const ownPacket = await users[0].client.rpc('candidate_get_my_preboarding_handoff', { p_application_id: application.id });
  assert(!ownPacket.error && ownPacket.data?.id === generatedHandoff.data.id, 'Candidate could not read their own tenant-scoped handoff.');
  const foreignPacket = await users[0].client.rpc('candidate_get_my_preboarding_handoff', { p_application_id: foreignApplicationId });
  assert(!foreignPacket.error && foreignPacket.data === null, 'Candidate A read a different tenant’s preboarding packet.');
  const foreignWrite = await users[0].client.rpc('candidate_save_my_preboarding_step', {
    p_application_id: foreignApplicationId, p_step_key: 'step_identity',
    p_payload: { national_id: 'FORGED', date_of_birth: '1990-01-01', nationality: 'Test', address: 'Test' },
  });
  assert(foreignWrite.error?.code === 'P0002', `Cross-candidate write was not denied: ${JSON.stringify(foreignWrite.error)}`);
  const postSubmitWrite = await users[0].client.rpc('candidate_save_my_preboarding_step', {
    p_application_id: application.id, p_step_key: 'step_identity',
    p_payload: { national_id: 'OVERWRITE', date_of_birth: '1990-01-01', nationality: 'Test', address: 'Test' },
  });
  assert(postSubmitWrite.error?.code === '42501', `Submitted packet could still be edited: ${JSON.stringify(postSubmitWrite.error)}`);
  const candidateBOwnPacket = await users[1].client.rpc('candidate_get_my_preboarding_handoff', { p_application_id: foreignApplicationId });
  assert(!candidateBOwnPacket.error && candidateBOwnPacket.data?.candidate_personal_data?.national_id === 'TEST-B-NID', 'Candidate B could not read their own packet.');
  const anonymousPacket = await anon.rpc('candidate_get_my_preboarding_handoff', { p_application_id: application.id });
  assert(anonymousPacket.error?.code === '42501', 'Anonymous caller was not denied preboarding access.');
  const directCandidateRead = await users[0].client.from('onboarding_handoffs').select('id').eq('id', generatedHandoff.data.id);
  assert(directCandidateRead.error?.code === '42501', `Candidate direct table read was not denied: ${JSON.stringify(directCandidateRead.error)}`);
  const directCandidateWrite = await users[0].client.from('onboarding_handoffs').update({ status: 'completed' }).eq('id', generatedHandoff.data.id);
  assert(directCandidateWrite.error?.code === '42501', `Candidate direct table write was not denied: ${JSON.stringify(directCandidateWrite.error)}`);

  const managerAQueue = await staff[0].client.rpc('hris_get_candidate_preboarding_queue', { p_tenant_id: tenantA });
  assert(!managerAQueue.error && managerAQueue.data.length === 1 && managerAQueue.data[0].candidate_email === users[0].email,
    `Tenant A recruitment manager did not receive only the submitted tenant A packet: ${JSON.stringify(managerAQueue.error)}`);
  const managerBCannotReadA = await staff[2].client.rpc('hris_get_candidate_preboarding_queue', { p_tenant_id: tenantA });
  assert(managerBCannotReadA.error?.code === '42501', 'Tenant B recruitment manager was not denied Tenant A queue access.');
  const managerBQueue = await staff[2].client.rpc('hris_get_candidate_preboarding_queue', { p_tenant_id: tenantB });
  assert(!managerBQueue.error && managerBQueue.data.length === 1 && managerBQueue.data[0].candidate_email === users[1].email,
    'Tenant B recruitment manager did not receive the tenant B handoff.');
  const viewerQueue = await staff[1].client.rpc('hris_get_candidate_preboarding_queue', { p_tenant_id: tenantA });
  assert(viewerQueue.error?.code === '42501', 'Recruitment view-only role was allowed to see private preboarding details.');
  const candidateQueue = await users[0].client.rpc('hris_get_candidate_preboarding_queue', { p_tenant_id: tenantA });
  assert(candidateQueue.error?.code === '42501', 'Candidate was allowed to read the HR preboarding queue.');
  const managerDirectRead = await staff[0].client.from('onboarding_handoffs').select('id');
  assert(managerDirectRead.error?.code === '42501', 'Recruitment manager bypassed the authorized queue RPC with direct table access.');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Preboarding & Employee Transition' }).waitFor({ timeout: 20000 });
  assert(await page.getByLabel(/National ID/).isDisabled(), 'Desktop preboarding journey did not recover the submitted, locked state.');
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Desktop preboarding journey overflows the viewport.');

  await mainManagerPage.reload({ waitUntil: 'domcontentloaded' });
  await mainManagerPage.getByRole('heading', { name: 'Candidate pipeline' }).waitFor({ timeout: 20000 });
  await mainManagerPage.getByRole('heading', { name: 'Preboarding handoffs' }).waitFor({ timeout: 20000 });
  await mainManagerPage.locator('section[aria-labelledby="preboarding-queue-heading"]').getByText(users[0].email, { exact: true }).waitFor();
  assert(!(await mainManagerPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'Mobile HR preboarding queue overflows the viewport.');

  const viewOnlyContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const viewOnlyPage = await viewOnlyContext.newPage();
  viewOnlyPage.on('pageerror', error => browserErrors.push(error.message));
  await viewOnlyPage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: staff[1].session,
  });
  await viewOnlyPage.goto(`http://127.0.0.1:${mainPort}/`, { waitUntil: 'domcontentloaded' });
  await viewOnlyPage.getByRole('heading', { name: 'Candidate pipeline' }).waitFor({ timeout: 20000 });
  assert(await viewOnlyPage.getByText('Issue offer', { exact: true }).count() === 0, 'Recruitment view-only UI exposed the offer issue action.');
  assert(await viewOnlyPage.getByText('Assign assessment', { exact: true }).count() === 0, 'Recruitment view-only UI exposed assessment assignment.');
  assert(await viewOnlyPage.getByRole('heading', { name: 'Candidate assessments' }).count() === 0, 'Recruitment view-only UI exposed candidate assessment submissions.');
  assert(await viewOnlyPage.getByRole('heading', { name: 'Preboarding handoffs' }).count() === 0, 'Recruitment view-only UI exposed the private preboarding queue.');
  await viewOnlyContext.close();
  await mainManager.close();
  await preboardingMobile.close();
  assert(browserErrors.length === 0, `Browser errors occurred: ${browserErrors.join('; ')}`);

  process.stdout.write(`CANDIDATE_APPLICATION_LOCAL_E2E PASS=${checks} FAIL=0 viewports=mobile+desktop auth=local-gotrue postgres=persisted candidate_application=verified+persisted-stage-history assessments=assign+candidate-submit+review+tenant-scoped interviews=schedule+reschedule+candidate-acceptance+tenant-scoped preboarding=accepted-offer+4-step+refresh+submission manager_queue=tenant-scoped viewer-denied+direct-access-denied\n`);
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), wait(3000)]);
  }
  if (mainServer && mainServer.exitCode === null) {
    mainServer.kill('SIGTERM');
    await Promise.race([new Promise(resolve => mainServer.once('exit', resolve)), wait(3000)]);
  }
  for (const userId of createdUsers) {
    await cleanupTestUser(userId);
  }
  await cleanupStaleTestJobs();
  const usersAtEnd = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersAtEnd.error || usersAtEnd.data.users.length !== 0) {
    throw usersAtEnd.error || new Error('Local Auth cleanup did not return to the empty starting state.');
  }
}
