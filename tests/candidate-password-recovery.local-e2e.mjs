import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const candidateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainRoot = process.env.HRIS_MAIN_REPO_ROOT || path.resolve(candidateRoot, '../HRIS-v2');
const mainRequire = createRequire(path.join(mainRoot, 'package.json'));
const { chromium } = mainRequire('playwright');
const port = process.env.CANDIDATE_RECOVERY_PORT || '35679';
const origin = `http://127.0.0.1:${port}`;
const authHost = 'https://candidate-auth.invalid';
const user = {
  id: 'candid00000000000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'candidate.recovery@example.test',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Synthetic Candidate' },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
const session = {
  access_token: 'synthetic-candidate-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'synthetic-candidate-refresh-token',
  user,
};
const testEnv = {
  ...process.env,
  VITE_SUPABASE_URL: authHost,
  VITE_SUPABASE_ANON_KEY: 'synthetic-only-test-key',
  VITE_ENABLE_DEMO_MODE: 'false',
  VITE_CANDIDATE_PUBLIC_ONLY: 'false',
};
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
  cwd: candidateRoot,
  env: testEnv,
  stdio: 'ignore',
});
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Local Candidate Vite server exited with ${server.exitCode}.`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch { /* local server is starting */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the local Candidate password recovery test server.');
}

async function json(route, body, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function recoveryCallback() {
  return `${origin}/?auth_flow=recovery#access_token=synthetic-candidate-access-token&refresh_token=synthetic-candidate-refresh-token&expires_in=3600&token_type=bearer&type=recovery`;
}

async function isolatedContext(viewport, state) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  state.blockedHosts = new Set();
  state.authRequestHosts = new Set();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === new URL(authHost).hostname) {
      state.authRequestHosts.add(url.hostname);
      const pathname = url.pathname;
      const method = route.request().method();
      if (pathname === '/auth/v1/recover' && method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '{}');
        state.recoveryEmail = payload.email;
        state.recoveryRedirect = url.searchParams.get('redirect_to')
          || payload.redirect_to || payload.options?.redirectTo || payload.options?.redirect_to;
        return json(route, {});
      }
      if (pathname === '/auth/v1/signup' && method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '{}');
        state.signupEmail = payload.email;
        state.signupRedirect = url.searchParams.get('redirect_to')
          || payload.redirect_to || payload.options?.emailRedirectTo || payload.options?.email_redirect_to;
        return json(route, { user, session: null });
      }
      if (pathname === '/auth/v1/user' && method === 'GET') {
        return state.authenticated ? json(route, user) : json(route, { message: 'Auth session missing', status: 401 }, 401);
      }
      if (pathname === '/auth/v1/user' && method === 'PUT') {
        const payload = JSON.parse(route.request().postData() || '{}');
        state.updatedPassword = payload.password;
        state.authenticated = true;
        return json(route, user);
      }
      if (pathname === '/auth/v1/logout') {
        state.logoutCount = (state.logoutCount || 0) + 1;
        state.authenticated = false;
        return route.fulfill({ status: 204, body: '' });
      }
      if (pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        const payload = JSON.parse(route.request().postData() || '{}');
        state.signInAttempts = [...(state.signInAttempts || []), payload];
        if (payload.email !== user.email || payload.password !== 'Candidate-Recovered-2026!') {
          return json(route, { message: 'Invalid login credentials', status: 400 }, 400);
        }
        state.authenticated = true;
        return json(route, session);
      }
      if (pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
      if (pathname.startsWith('/auth/v1/')) return json(route, { message: 'Unexpected synthetic Auth request', status: 404 }, 404);
      return json(route, []);
    }
    if (url.hostname === 'fonts.googleapis.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    state.blockedHosts.add(url.hostname);
    return route.abort();
  });
  return { context, page };
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const signupState = { authenticated: false };
  const signup = await isolatedContext({ width: 1280, height: 800 }, signupState);
  await signup.page.goto(`${origin}/?campaign=synthetic`);
  await signup.page.getByRole('button', { name: 'Sign In', exact: true }).click();
  let signupDialog = signup.page.getByRole('dialog', { name: 'Welcome Back' });
  await signupDialog.getByRole('button', { name: 'Create one now' }).click();
  signupDialog = signup.page.getByRole('dialog', { name: 'Create Candidate Account' });
  await signupDialog.getByLabel('Full Legal Name').fill('Synthetic Candidate');
  await signupDialog.getByLabel('Email Address').fill(user.email);
  await signupDialog.getByLabel('Password').fill('Synthetic-Signup-2026!');
  await signupDialog.getByRole('button', { name: 'Create Candidate Account' }).click();
  await signupDialog.getByRole('status').getByText('Account created. Verify your email before signing in.').waitFor();
  assert.equal(signupState.signupEmail, user.email);
  assert.equal(signupState.signupRedirect, `${origin}/`, 'Email confirmation must return to the Candidate app, not the project Site URL.');
  assert.equal(signupState.authenticated, false, 'Email confirmation must not be treated as an authenticated session.');
  await signup.context.close();

  for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    const state = { authenticated: false };
    const { context, page } = await isolatedContext(viewport, state);
    await page.goto(`${origin}/?campaign=synthetic`);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Welcome Back' });
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Forgot password?' }).click();
    dialog = page.getByRole('dialog', { name: 'Reset Your Password' });
    await dialog.getByLabel('Email Address').fill(user.email);
    await dialog.getByRole('button', { name: 'Send Recovery Email' }).click();
    await dialog.getByRole('status').getByText('Password reset instructions sent. Please check your inbox.').waitFor();
    assert.equal(state.recoveryEmail, user.email);
    assert.equal(state.recoveryRedirect, `${origin}/?auth_flow=recovery`, 'Recovery must return to the Candidate app path, without unrelated query or fragment state.');

    if (viewport.width === 375) await dialog.getByRole('button', { name: 'Switch to Bengali' }).click();
    state.authenticated = true;
    await page.goto(recoveryCallback());
    const title = viewport.width === 375 ? 'নতুন পাসওয়ার্ড নির্ধারণ করুন' : 'Set a New Password';
    dialog = page.getByRole('dialog', { name: title });
    await dialog.waitFor({ state: 'visible' });
    const newPassword = dialog.getByLabel(viewport.width === 375 ? 'নতুন পাসওয়ার্ড' : 'New Password', { exact: true });
    const confirmPassword = dialog.getByLabel(viewport.width === 375 ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password', { exact: true });
    await newPassword.fill('Candidate-Recovered-2026!');
    await confirmPassword.fill('Candidate-Does-Not-Match!');
    await dialog.getByRole('button', { name: viewport.width === 375 ? 'পাসওয়ার্ড হালনাগাদ করুন' : 'Update Password' }).click();
    await dialog.getByRole('alert').getByText(viewport.width === 375 ? 'পাসওয়ার্ড দুটি মেলেনি।' : 'Passwords do not match.').waitFor();
    assert.equal(state.updatedPassword, undefined, 'A mismatch must not call Auth updateUser.');

    await confirmPassword.fill('Candidate-Recovered-2026!');
    await dialog.getByRole('button', { name: viewport.width === 375 ? 'পাসওয়ার্ড হালনাগাদ করুন' : 'Update Password' }).click();
    dialog = page.getByRole('dialog', { name: viewport.width === 375 ? 'আবার স্বাগতম' : 'Welcome Back' });
    await dialog.getByRole('status').getByText(viewport.width === 375
      ? 'পাসওয়ার্ড হালনাগাদ হয়েছে। নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন।'
      : 'Password updated. Please sign in with your new password.').waitFor();
    assert.equal(state.updatedPassword, 'Candidate-Recovered-2026!');

    if (viewport.width === 375) {
      await dialog.getByRole('button', { name: 'ইংরেজিতে পরিবর্তন করুন' }).click();
      dialog = page.getByRole('dialog', { name: 'Welcome Back' });
    }
    await dialog.getByLabel('Email Address').fill(user.email);
    await dialog.getByLabel('Password').fill('Candidate-Recovered-2026!');
    await dialog.getByRole('button', { name: 'Sign In to Synesis Careers' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(state.signInAttempts?.at(-1)?.password, 'Candidate-Recovered-2026!');
    assert.deepEqual([...state.blockedHosts], [], 'All non-local external hosts must remain blocked.');
    assert.deepEqual([...state.authRequestHosts], ['candidate-auth.invalid']);
    if (viewport.width === 375) {
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(dimensions.document <= dimensions.viewport, `Candidate recovery mobile overflow: ${JSON.stringify(dimensions)}.`);
    }
    await context.close();
  }

  const cancelState = { authenticated: true };
  const { context, page } = await isolatedContext({ width: 375, height: 812 }, cancelState);
  await page.goto(recoveryCallback());
  const dialog = page.getByRole('dialog', { name: 'Set a New Password' });
  await dialog.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(cancelState.updatedPassword, undefined, 'Cancelling must not change the password.');
  assert.ok(cancelState.logoutCount > 0, 'Cancelling must clear the local recovery session.');
  await context.close();

  const expiredState = { authenticated: false };
  const expired = await isolatedContext({ width: 375, height: 812 }, expiredState);
  await expired.page.goto(`${origin}/?auth_flow=recovery&error_code=otp_expired&error_description=Email+link+expired`);
  const expiredDialog = expired.page.getByRole('dialog', { name: 'Reset Your Password' });
  await expiredDialog.waitFor({ state: 'visible' });
  await expiredDialog.getByRole('status').getByText('This password reset link expired or was already used. Request a new password reset email.').waitFor();
  await expiredDialog.getByLabel('Email Address').fill(user.email);
  await expiredDialog.getByRole('button', { name: 'Send Recovery Email' }).click();
  await expiredDialog.getByRole('status').getByText('Password reset instructions sent. Please check your inbox.').waitFor();
  assert.equal(expiredState.recoveryEmail, user.email, 'Expired-link recovery must allow requesting a fresh email.');
  await expired.context.close();

  process.stdout.write('Candidate signup confirmation and password-recovery redirect, callback, mismatch validation, password update, sign-in, cancellation, expired-link retry, EN/BN and 375px/1280px checks passed against isolated synthetic Auth; no live Auth account or external host was used.\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
