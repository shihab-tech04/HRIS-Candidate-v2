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
const password = `candidate-apply-${randomUUID()}`;
const users = [
  { email: `candidate-apply-a-${Date.now()}@c1.test`, name: 'Candidate A', tenantId: tenantA },
  { email: `candidate-apply-b-${Date.now()}@c1.test`, name: 'Candidate B', tenantId: tenantB },
];
const createdUsers = [];
const profiles = [];
const signedClients = [];
let server;
let browser;
let checks = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); checks++; };
const sql = value => `'${String(value).replaceAll("'", "''")}'`;

async function cleanupTestUser(userId) {
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
  path.join(mainRoot, 'supabase/migrations/20261013080630_hris_candidate_application_document.sql'),
];
for (const migration of migrationPaths) readFileSync(migration, 'utf8');

const startUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (startUsers.error) throw startUsers.error;
const staleTestUsers = startUsers.data.users.filter(user => /^candidate-apply-[ab]-\d+@c1\.test$/.test(user.email || ''));
const otherExistingUsers = startUsers.data.users.filter(user => !staleTestUsers.includes(user));
if (otherExistingUsers.length) {
  throw new Error('Refusing to change local Auth because the dedicated test stack contains entries not created by this application test.');
}
for (const staleUser of staleTestUsers) await cleanupTestUser(staleUser.id);
await cleanupStaleTestJobs();
const cleanUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (cleanUsers.error || cleanUsers.data.users.length !== 0) throw cleanUsers.error || new Error('Local Auth did not return to an empty state.');
const idCollision = psql(`SELECT count(*) FROM public.jobs WHERE id IN (${sql(jobId)},${sql(otherTenantJobId)})`).trim();
if (idCollision !== '0') throw new Error('Refusing to overwrite a local test job.');

try {
  psql(readFileSync(path.join(candidateRoot, 'tests/candidate-application-local-fixture.sql'), 'utf8'));
  for (const migration of migrationPaths) psql(readFileSync(migration, 'utf8'));

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
  browser = await chromium.launch({ headless: true });

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobile.newPage();
  const browserErrors = [];
  mobilePage.on('pageerror', error => browserErrors.push(error.message));
  await mobilePage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey: `sb-${apiUrl.hostname.split('.')[0]}-auth-token`, session: users[0].session,
  });
  await mobilePage.goto(`http://127.0.0.1:${webPort}/?view=apply&job=${jobId}`, { waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('heading', { name: 'Apply for Senior Systems Engineer' }).waitFor({ timeout: 20000 });
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
  const page = await desktop.newPage();
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
  assert(browserErrors.length === 0, `Browser errors occurred: ${browserErrors.join('; ')}`);

  process.stdout.write(`CANDIDATE_APPLICATION_LOCAL_E2E PASS=${checks} FAIL=0 viewports=mobile+desktop auth=local-gotrue postgres=persisted draft=refresh+cross-device tenant+owner+duplicate=denied private_upload=verified required_doc_submission=verified\n`);
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), wait(3000)]);
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
