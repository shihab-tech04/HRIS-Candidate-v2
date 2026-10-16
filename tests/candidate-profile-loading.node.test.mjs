import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auth = readFileSync(path.join(root, 'src/context/AuthContext.tsx'), 'utf8');
const profile = readFileSync(path.join(root, 'src/pages/ProfilePage.tsx'), 'utf8');

test('candidate profile data loading and failures are represented before editable form state', () => {
  assert.match(auth, /profileLoading: boolean/);
  assert.match(auth, /profileError: string \| null/);
  assert.match(auth, /setProfileLoading\(true\)[\s\S]*?getMyCandidateProfile\(userId\)[\s\S]*?finally\s*\{\s*setProfileLoading\(false\)/);
  assert.match(profile, /if \(authLoading \|\| profileLoading\)[\s\S]*?Loading your HRMIS profile/);
  assert.match(profile, /if \(!user \|\| !profile\)[\s\S]*?Unable to load your candidate profile[\s\S]*?role="alert"/);
  assert.match(profile, /onClick=\{\(\) => void refreshProfile\(\)\}[\s\S]*?>\s*Retry\s*</);
});

test('profile form fields and list removal actions expose accessible names', () => {
  for (const [label, id] of [
    ['Full Legal Name', 'candidate-full-name'], ['Current Location', 'candidate-location'],
    ['Professional Headline', 'candidate-headline'], ['Professional Bio & Executive Summary', 'candidate-summary'],
    ['LinkedIn Profile', 'candidate-linkedin'], ['GitHub Profile', 'candidate-github'],
    ['Portfolio Website', 'candidate-portfolio'],
  ]) {
    assert.match(profile, new RegExp(`label htmlFor="${id}"[\\s\\S]*?<input[\\s\\S]*?id="${id}"|label htmlFor="${id}"[\\s\\S]*?<textarea[\\s\\S]*?id="${id}"`), `${label} must label its input`);
  }
  assert.match(profile, /aria-label=\{`Remove skill \$\{skill\}`\}/);
  assert.match(profile, /aria-label=\{`Remove certification \$\{cert\}`\}/);
});
