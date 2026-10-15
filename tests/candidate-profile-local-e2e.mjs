import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const candidateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainRoot = process.env.HRIS_MAIN_REPO_ROOT || path.resolve(candidateRoot, '../HRIS-v2');
const testWorkdir = process.env.HRIS_CANDIDATE_C1_TEST_WORKDIR || '/private/tmp/synesis-candidate-c1-auth-20261013-1124';
const dockerContext = process.env.HRIS_DOCKER_CONTEXT || 'colima-hris-scratch';
const expectedApiPort = process.env.HRIS_CANDIDATE_C1_API_PORT || '55721';
const candidatePort = process.env.HRIS_CANDIDATE_E2E_PORT || '35521';
const cliEnv = { ...process.env, SUPABASE_HOME: process.env.SUPABASE_HOME || '/private/tmp/synesis-supabase-home', SUPABASE_TELEMETRY_DISABLED: '1', DOCKER_CONTEXT: dockerContext };
const parseEnv = (raw) => Object.fromEntries(raw.split(/\r?\n/).flatMap(line => {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) return [];
  return [[m[1], m[2].startsWith('"') ? JSON.parse(m[2]) : m[2]]];
}));
const status = parseEnv(execFileSync('supabase', ['status', '--output', 'env', '--workdir', testWorkdir], { env: cliEnv, encoding: 'utf8' }));
const configPath = path.join(testWorkdir, 'supabase/config.toml');
const testProjectId = readFileSync(configPath, 'utf8').match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (testProjectId !== path.basename(testWorkdir) || !testProjectId.startsWith('synesis-candidate-c1-auth-')) throw new Error('Refusing a non-dedicated Candidate C1 test project.');
const apiUrl = new URL(status.API_URL);
if (apiUrl.hostname !== '127.0.0.1' || apiUrl.port !== expectedApiPort) throw new Error('Refusing non-dedicated local Supabase API.');
const storageKey = `sb-${apiUrl.hostname.split('.')[0]}-auth-token`;
const candidateRequire = createRequire(path.join(candidateRoot, 'package.json'));
const mainRequire = createRequire(path.join(mainRoot, 'package.json'));
const { createClient } = candidateRequire('@supabase/supabase-js');
const { chromium } = mainRequire('playwright');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = 'candidate-inactive@c1.test';
const activeEmail = 'candidate-b@c1.test';
const password = `c1-${Date.now()}-${Math.random().toString(36).slice(2)}-local`;
let priorUserId;
let createdUserId;
let priorActiveUserId;
let createdActiveUserId;
let priorActiveProfile;
let server;
let browser;
let checks = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); checks++; };

try {
  const profileResult = await admin.from('candidate_profiles').select('user_id,tenant_id,profile_status').eq('email', email).single();
  if (profileResult.error || profileResult.data.profile_status !== 'inactive') throw profileResult.error || new Error('Expected inactive Candidate C1 fixture profile is missing.');
  priorUserId = profileResult.data.user_id;
  const usersAtStart = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersAtStart.error || usersAtStart.data.users.length !== 0) throw usersAtStart.error || new Error('Refusing to add test users while the isolated local Auth stack contains existing users.');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Inactive Candidate' } });
  if (created.error || !created.data.user) throw created.error || new Error('Unable to create local test user.');
  createdUserId = created.data.user.id;
  const rebound = await admin.from('candidate_profiles').update({ user_id: createdUserId }).eq('email', email);
  if (rebound.error) throw rebound.error;
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error || new Error('Local GoTrue sign-in failed.');

  const activeProfile = await admin.from('candidate_profiles').select('user_id,tenant_id,profile_status,full_name,phone,current_location,years_experience,headline,bio,skills,profile_data,onboarding_completed').eq('email', activeEmail).single();
  if (activeProfile.error || activeProfile.data.profile_status !== 'active' || activeProfile.data.tenant_id !== '22222222-2222-4222-8222-222222222222') throw activeProfile.error || new Error('Expected active tenant B candidate fixture is missing.');
  priorActiveUserId = activeProfile.data.user_id;
  priorActiveProfile = activeProfile.data;
  const resetProfile = await admin.from('candidate_profiles').update({
    full_name: 'Candidate B', phone: null, current_location: null, years_experience: null,
    headline: null, bio: null, skills: ['sql'], profile_data: { marker: 'profile-1' }, onboarding_completed: false,
  }).eq('user_id', priorActiveUserId);
  if (resetProfile.error) throw resetProfile.error;
  const createdActive = await admin.auth.admin.createUser({ email: activeEmail, password, email_confirm: true, user_metadata: { full_name: 'Candidate B' } });
  if (createdActive.error || !createdActive.data.user) throw createdActive.error || new Error('Unable to create active local candidate.');
  createdActiveUserId = createdActive.data.user.id;
  const activeRebound = await admin.from('candidate_profiles').update({ user_id: createdActiveUserId }).eq('email', activeEmail);
  if (activeRebound.error) throw activeRebound.error;
  const activeSignedIn = await anon.auth.signInWithPassword({ email: activeEmail, password });
  if (activeSignedIn.error || !activeSignedIn.data.session) throw activeSignedIn.error || new Error('Active local candidate sign-in failed.');

  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', candidatePort, '--strictPort'], {
    cwd: candidateRoot,
    env: { ...process.env, VITE_SUPABASE_URL: status.API_URL, VITE_SUPABASE_ANON_KEY: status.ANON_KEY, VITE_ENABLE_DEMO_MODE: 'false' },
    stdio: 'ignore',
  });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw new Error(`Candidate Vite exited early (${server.exitCode}).`);
    try { const response = await fetch(`http://127.0.0.1:${candidatePort}/`); if (response.ok) { ready = true; break; } } catch {}
    await wait(300);
  }
  assert(ready, 'Candidate Vite did not become ready.');
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1280, height: 800, label: 'desktop' }, { width: 375, height: 812, label: 'mobile' }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
      storageKey, session: signedIn.data.session,
    });
    await page.goto(`http://127.0.0.1:${candidatePort}/?view=dashboard`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Unable to load your workspace' }).waitFor({ timeout: 15000 });
    assert(await page.getByRole('alert').innerText().then(t => t.includes('Please retry.')), `${viewport.label}: authorization failure was not rendered accessibly.`);
    assert(await page.getByRole('button', { name: 'Retry' }).isVisible(), `${viewport.label}: retry action is missing. buttons=${JSON.stringify(await page.getByRole('button').allTextContents())} alert=${JSON.stringify(await page.getByRole('alert').innerText())}`);
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.getByRole('heading', { name: 'Unable to load your workspace' }).waitFor({ timeout: 10000 });
    assert(await page.getByRole('button', { name: 'Retry' }).isVisible(), `${viewport.label}: retry did not recover to an actionable error state.`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) {
      const details = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        offenders: Array.from(document.querySelectorAll('*')).map(el => {
          const rect = el.getBoundingClientRect();
          return { tag: el.tagName, className: typeof el.className === 'string' ? el.className : '', text: (el.textContent || '').trim().slice(0, 70), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
        }).filter(item => item.right > window.innerWidth + 1 || item.left < -1).sort((a, b) => b.right - a.right).slice(0, 12),
      }));
      process.stdout.write(`OVERFLOW_${viewport.label}=${JSON.stringify(details)}\n`);
    }
    assert(!overflow, `${viewport.label}: dashboard error state overflows the viewport.`);
    assert(pageErrors.length === 0, `${viewport.label}: uncaught browser errors: ${pageErrors.join('; ')}`);
    await context.close();
  }

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktopContext.newPage();
  desktopPage.on('pageerror', error => { throw error; });
  await desktopPage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey, session: activeSignedIn.data.session,
  });
  await desktopPage.goto(`http://127.0.0.1:${candidatePort}/?view=profile`, { waitUntil: 'domcontentloaded' });
  await desktopPage.getByRole('heading', { name: 'Reusable Candidate Profile' }).waitFor({ timeout: 15000 });
  assert(await desktopPage.getByLabel(/Current Location/).inputValue() === '', 'Tenant B Candidate Profile did not load the expected database DTO.');
  await desktopPage.getByLabel(/Current Location/).fill('Sylhet, Bangladesh');
  await desktopPage.getByLabel(/Professional Headline/).fill('C1 local profile save');
  await desktopPage.getByLabel(/Professional Bio & Executive Summary/).fill('Saved through the tenant-scoped Candidate Profile RPC.');
  await desktopPage.getByPlaceholder('e.g. Kubernetes, PostgreSQL, Figma').fill('C1 profile skill');
  await desktopPage.getByRole('button', { name: 'Add Skill' }).click();
  await desktopPage.getByRole('button', { name: 'Save Profile Changes' }).click();
  await desktopPage.getByText('Profile successfully updated in Synesis HRMIS.').waitFor({ timeout: 15000 });
  const persisted = await admin.from('candidate_profiles').select('tenant_id,email,full_name,current_location,headline,bio,skills,profile_data').eq('user_id', createdActiveUserId).single();
  assert(!persisted.error, `Tenant B profile persistence query failed: ${persisted.error?.message}`);
  assert(persisted.data.tenant_id === activeProfile.data.tenant_id && persisted.data.email === activeEmail, 'Candidate Profile save changed protected tenant or email fields.');
  assert(persisted.data.current_location === 'Sylhet, Bangladesh' && persisted.data.headline === 'C1 local profile save' && persisted.data.bio === 'Saved through the tenant-scoped Candidate Profile RPC.', `Candidate Profile form fields did not persist to the HRIS columns: ${JSON.stringify({ current_location: persisted.data.current_location, headline: persisted.data.headline, bio: persisted.data.bio })}`);
  assert(persisted.data.skills.includes('C1 profile skill') && persisted.data.profile_data.marker === 'profile-1', 'Candidate Profile skill did not persist or opaque profile data was lost.');
  await desktopContext.close();

  const mobileProfileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobileProfilePage = await mobileProfileContext.newPage();
  await mobileProfilePage.addInitScript(({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)), {
    storageKey, session: activeSignedIn.data.session,
  });
  await mobileProfilePage.goto(`http://127.0.0.1:${candidatePort}/?view=profile`, { waitUntil: 'domcontentloaded' });
  await mobileProfilePage.getByRole('heading', { name: 'Reusable Candidate Profile' }).waitFor({ timeout: 15000 });
  assert(await mobileProfilePage.getByLabel(/Current Location/).inputValue() === 'Sylhet, Bangladesh', 'Mobile Candidate Profile did not recover the saved value after refresh.');
  const mobileOverflow = await mobileProfilePage.evaluate(() => {
    const viewport = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    if (documentWidth <= viewport) return null;
    return {
      viewport,
      documentWidth,
      offenders: Array.from(document.querySelectorAll('*')).map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      }).filter(item => item.right > viewport + 1 || item.left < -1)
        .sort((left, right) => right.right - left.right).slice(0, 12),
    };
  });
  if (mobileOverflow) process.stdout.write(`CANDIDATE_PROFILE_OVERFLOW=${JSON.stringify(mobileOverflow)}\n`);
  assert(!mobileOverflow, 'Mobile Candidate Profile overflows the viewport.');
  await mobileProfileContext.close();
  assert(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }).then(r => !r.error && r.data.users.length === 2), 'Expected exactly two temporary local Auth users during browser acceptance.');
  process.stdout.write(`CANDIDATE_C1_LOCAL_E2E PASS=${checks} FAIL=0 viewports=2 inactive_retry=2 profile_read_write=tenant-B refresh=verified auth=local-gotrue\n`);
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await Promise.race([new Promise(resolve => server.once('exit', resolve)), wait(3000)]); }
  if (createdUserId) {
    await admin.from('candidate_profiles').update({ user_id: priorUserId }).eq('email', email);
    const deleted = await admin.auth.admin.deleteUser(createdUserId);
    if (deleted.error) throw deleted.error;
  }
  if (createdActiveUserId) {
    await admin.from('candidate_profiles').update({ user_id: priorActiveUserId }).eq('email', activeEmail);
    const deleted = await admin.auth.admin.deleteUser(createdActiveUserId);
    if (deleted.error) throw deleted.error;
  }
  if (priorActiveProfile) {
    const restored = await admin.from('candidate_profiles').update({
      full_name: priorActiveProfile.full_name, phone: priorActiveProfile.phone,
      current_location: priorActiveProfile.current_location, years_experience: priorActiveProfile.years_experience,
      headline: priorActiveProfile.headline, bio: priorActiveProfile.bio, skills: priorActiveProfile.skills,
      profile_data: priorActiveProfile.profile_data, onboarding_completed: priorActiveProfile.onboarding_completed,
    }).eq('user_id', priorActiveUserId);
    if (restored.error) throw restored.error;
  }
}
