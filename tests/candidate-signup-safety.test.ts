import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const auth = readFileSync('src/context/AuthContext.tsx','utf8');
const modal = readFileSync('src/components/auth/AuthModal.tsx','utf8');

test('a verified Supabase sign-up session is accepted without demo mode', () => {
  expect(auth).toContain('if (!data.session) return {');
  expect(auth).toContain('verificationRequired: true');
  expect(auth).toContain('id: data.user.id,');
  expect(auth).toContain('setUser(u);');
  expect(auth).not.toContain("if (!DEMO_MODE) return { success: false, error: 'Registration service unavailable.' };\n    const u: User = {\n            id: data.user.id");
});

test('production cannot create synthetic user identity when registration is unavailable', () => {
  expect(auth).toContain("// In production an unavailable backend must never create a local candidate identity.");
  expect(auth).toContain("if (!DEMO_MODE) return { success: false, error: 'Registration service unavailable.' };");
  expect(auth).toContain("if (DEMO_MODE) localStorage.setItem('synesis_candidate_auth_session', JSON.stringify(u));");
  expect(auth).toContain("supabase.auth.signUp({");
});

test('email confirmation is informational and does not advance the application as authenticated', () => {
  expect(modal).toContain('if (res.verificationRequired) {');
  expect(modal).toContain('setSuccessMsg(res.error');
  expect(modal).toContain('} else if (!res.success) {');
  expect(auth).toContain('Verify your email before signing in.');
});
