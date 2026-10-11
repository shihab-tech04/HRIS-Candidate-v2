import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
test('client uses verified candidate authentication', () => {
  const source=readFileSync('src/context/AuthContext.tsx','utf8');
  expect(source).toContain('supabase.auth.getUser()');
  expect(source).toContain('DEMO_MODE');
});
test('applications use verified CV and server drafts', () => {
  const source=readFileSync('src/pages/VerifiedApplyPage.tsx','utf8');
  expect(source).toContain('listCandidateCVs');
  expect(source).toContain('saveVerifiedApplicationDraft');
});
