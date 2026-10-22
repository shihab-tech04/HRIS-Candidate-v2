import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/components/auth/AuthModal.tsx', import.meta.url), 'utf8');
const browser = readFileSync(new URL('./candidate-auth-accessibility.local-e2e.mjs', import.meta.url), 'utf8');

test('Candidate Auth is a named modal dialog with contained and restored keyboard focus', () => {
  assert.match(modal, /role="dialog" aria-modal="true" aria-labelledby="candidate-auth-dialog-title" aria-describedby="candidate-auth-dialog-description"/);
  assert.match(modal, /document.addEventListener\('keydown', onKeyDown\)/);
  assert.match(modal, /event.key === 'Escape'[\s\S]*?onClose\(\)/);
  assert.match(modal, /event.shiftKey && activeIndex === 0[\s\S]*?last.focus\(\)/);
  assert.match(modal, /!event.shiftKey && activeIndex === focusable.length - 1[\s\S]*?first.focus\(\)/);
  assert.match(modal, /openerRef.current = document.activeElement/);
  assert.match(modal, /if \(opener\?.isConnected\) opener.focus\(\)/);
  assert.match(browser, /Candidate auth dialog is labelled and traps\/restores focus at 1280px and 375px/);
});

test('Candidate Auth labels every field and announces errors and success states', () => {
  for (const field of ['full-name', 'email', 'password']) {
    assert.match(modal, new RegExp(`id="candidate-auth-${field}"`));
    assert.match(modal, new RegExp(`htmlFor="candidate-auth-${field}"`));
  }
  assert.match(modal, /role="alert" aria-live="assertive"/);
  assert.match(modal, /role="status" aria-live="polite"/);
});


const signupSource = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
const qaEnv = readFileSync(new URL('../.env.qa', import.meta.url), 'utf8');

test('Candidate signup requires explicit tenant-scoped signup metadata (no silent default)', () => {
  assert.match(signupSource, /VITE_CANDIDATE_TENANT_SLUG/);
  assert.match(signupSource, /if \(!\/\^\[a-z0-9\]/);
  assert.match(signupSource, /account_type: 'candidate', tenant_slug: tenantSlug/);
  assert.match(signupSource, /Candidate tenant is not configured/);
  assert.doesNotMatch(signupSource, /tenantSlug\s*=\s*['"]synesis-it['"]/);
  assert.match(qaEnv, /^VITE_CANDIDATE_TENANT_SLUG=synesis-it$/m);
  assert.match(qaEnv, /^VITE_SUPABASE_URL=https:\/\/xfuxnljfrgvusbrpvxpa\.supabase\.co$/m);
  assert.match(qaEnv, /^VITE_SUPABASE_ANON_KEY=sb_publishable_[A-Za-z0-9_-]+$/m);
  assert.doesNotMatch(qaEnv, /service_role|sb_secret_/);
});
