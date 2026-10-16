import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const candidateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainRoot = process.env.HRIS_MAIN_REPO_ROOT || path.resolve(candidateRoot, '../HRIS-v2');
const mainRequire = createRequire(path.join(mainRoot, 'package.json'));
const { chromium } = mainRequire('playwright');
const port = process.env.CANDIDATE_AUTH_ACCESSIBILITY_PORT || '35677';
const origin = `http://127.0.0.1:${port}`;
const testEnv = {
  ...process.env,
  VITE_SUPABASE_URL: 'https://hris-auth-accessibility.invalid',
  VITE_SUPABASE_ANON_KEY: 'synthetic-only-test-key',
  VITE_ENABLE_DEMO_MODE: 'false',
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
  throw new Error('Timed out waiting for the local Candidate UI server.');
}

async function createIsolatedPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const blockedHosts = new Set();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'fonts.googleapis.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    blockedHosts.add(url.hostname);
    return route.abort();
  });
  return { context, page, blockedHosts };
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    const { context, page, blockedHosts } = await createIsolatedPage(viewport);
    await page.goto(origin);
    const signInTrigger = page.getByRole('button', { name: 'Sign In', exact: true });
    await signInTrigger.waitFor({ state: 'visible' });
    await signInTrigger.click();

    let dialog = page.getByRole('dialog', { name: 'Welcome Back' });
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    const email = dialog.getByLabel('Email Address', { exact: true });
    const password = dialog.getByLabel('Password', { exact: true });
    await email.waitFor({ state: 'visible' });
    await password.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement?.id === 'candidate-auth-email');

    if (viewport.width === 375) {
      await dialog.getByRole('button', { name: 'Switch to Bengali' }).click();
      dialog = page.getByRole('dialog', { name: 'আবার স্বাগতম' });
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => document.documentElement.lang), 'bn');
      assert.equal(await dialog.getByLabel('ইমেইল ঠিকানা').count(), 1);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(dimensions.document <= dimensions.viewport, `Candidate Auth mobile modal overflowed: ${JSON.stringify(dimensions)}.`);
    }

    const close = dialog.getByRole('button', { name: viewport.width === 375 ? 'সাইন-ইন ডায়ালগ বন্ধ করুন' : 'Close authentication dialog' });
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    const finalAction = dialog.getByRole('button', { name: viewport.width === 375 ? 'এখনই অ্যাকাউন্ট তৈরি করুন' : 'Create one now' });
    await finalAction.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const active = document.activeElement;
      return active instanceof HTMLElement && active.textContent?.includes('Create one now')
        || active instanceof HTMLElement && active.textContent?.includes('এখনই অ্যাকাউন্ট তৈরি করুন');
    });

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    const restoredTrigger = page.getByRole('button', { name: viewport.width === 375 ? 'সাইন ইন' : 'Sign In', exact: true });
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Sign In'
      || document.activeElement?.textContent?.trim() === 'সাইন ইন');
    assert.equal(await restoredTrigger.evaluate(element => element === document.activeElement), true);
    assert.equal(blockedHosts.has('hris-auth-accessibility.invalid'), true, 'The dummy Auth endpoint should be intercepted locally.');
    await context.close();
  }

  process.stdout.write('Candidate auth dialog is labelled and traps/restores focus at 1280px and 375px; Bengali labels, mobile overflow, and external-network isolation passed.\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
