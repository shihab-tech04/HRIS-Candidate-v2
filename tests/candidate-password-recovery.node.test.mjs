import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { candidateAppRedirectTo, candidateRecoveryCallbackError, candidateRecoveryRedirectTo } from '../src/lib/candidateRecovery.ts';

const authContext = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/components/auth/AuthModal.tsx', import.meta.url), 'utf8');
const locale = readFileSync(new URL('../src/lib/candidateLocale.ts', import.meta.url), 'utf8');

test('Candidate Auth callbacks preserve the app path without carrying unrelated query or fragment state', () => {
  const location = {
    origin: 'https://careers.example.test',
    pathname: '/HRIS-Candidate-v2/',
  };
  assert.equal(candidateAppRedirectTo(location), 'https://careers.example.test/HRIS-Candidate-v2/');
  assert.equal(candidateRecoveryRedirectTo(location), 'https://careers.example.test/HRIS-Candidate-v2/?auth_flow=recovery');
  assert.match(authContext, /emailRedirectTo:\s*candidateAppRedirectTo\(window\.location\)/);
  assert.match(authContext, /resetPasswordForEmail\(email,\s*\{\s*redirectTo:\s*candidateRecoveryRedirectTo\(window\.location\)/);
});

test('expired Supabase recovery links provide a retry path without exposing callback tokens', () => {
  const message = 'This password reset link expired or was already used. Request a new password reset email.';
  assert.equal(candidateRecoveryCallbackError({ search: '?auth_flow=recovery&error_code=otp_expired', hash: '' }), message);
  assert.equal(candidateRecoveryCallbackError({ search: '', hash: '#auth_flow=recovery&error_code=otp_expired' }), message);
  assert.equal(candidateRecoveryCallbackError({ search: '?auth_flow=signup&error_code=otp_expired', hash: '' }), null);
  assert.equal(candidateRecoveryCallbackError({ search: '?error_code=other', hash: '' }), null);
  assert.match(app, /passwordRecoveryError/);
  assert.match(modal, /role="status" className="mb-4 p-3 bg-sky-50/);
});

test('the recovery event opens a dedicated password-update journey and cancellation clears its session', () => {
  assert.match(authContext, /event === 'PASSWORD_RECOVERY'\) setPasswordRecoveryRequired\(true\)/);
  assert.ok(authContext.indexOf('onAuthStateChange') < authContext.indexOf('auth.getUser()'), 'Listen before restoring the callback session.');
  assert.match(authContext, /auth\.updateUser\(\{ password \}\)/);
  assert.match(authContext, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(app, /passwordRecoveryRequired/);
  assert.match(app, /setAuthModalMode\('recovery'\)/);
  assert.match(app, /cancelPasswordRecovery\(\)/);
});

test('recovery form confirms the new password and keeps state and errors accessible', () => {
  assert.match(modal, /mode === 'recovery'/);
  assert.match(modal, /password !== confirmPassword/);
  assert.match(modal, /candidate-auth-confirm-password/);
  assert.match(modal, /Password update failed\. Please retry\./);
  assert.match(modal, /role="alert" aria-live="assertive"/);
  assert.match(modal, /role="status" aria-live="polite"/);
  for (const phrase of [
    'Choose and confirm a new password for your account.',
    'New Password',
    'Confirm New Password',
    'Update Password',
    'Password updated. Please sign in with your new password.',
  ]) assert.ok(locale.includes(`'${phrase}'`), `Missing EN/BN translation entry: ${phrase}`);
});
