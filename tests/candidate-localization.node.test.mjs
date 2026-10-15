import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CANDIDATE_BENGALI, translateCandidateText } from '../src/lib/candidateLocale.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('candidate locale translates workflow copy and interpolates dynamic values', () => {
  assert.equal(translateCandidateText('Open Roles', 'bn'), 'চলতি চাকরি');
  assert.equal(translateCandidateText('Apply for {title}', 'bn', { title: 'Senior Engineer' }), 'Senior Engineer পদে আবেদন করুন');
  assert.equal(translateCandidateText('Application submitted.', 'bn'), 'আবেদন জমা হয়েছে।');
  assert.equal(translateCandidateText('Candidate-authored note', 'bn'), 'Candidate-authored note');
  assert.equal(translateCandidateText('Answer the required question: How do you work?', 'bn'), 'আবশ্যিক প্রশ্নের উত্তর দিন: How do you work?');
  assert.equal(translateCandidateText('Apply for {title}', 'en', { title: 'Senior Engineer' }), 'Apply for Senior Engineer');
});

test('public vacancy count does not claim applications are open', () => {
  const copy = translateCandidateText('{count} active positions available', 'bn', { count: '৩' });
  assert.equal(copy, '৩টি পদ প্রকাশিত আছে');
  assert.doesNotMatch(copy, /আবেদন খোলা/);
});

test('candidate language selection persists and applies the document language', () => {
  const context = readFileSync(path.join(root, 'src/context/CandidateLocaleContext.tsx'), 'utf8');
  assert.match(context, /synesis-candidate-locale-v1/);
  assert.match(context, /document\.documentElement\.lang = locale/);
  assert.match(context, /aria-label=\{label\}/);
  assert.ok(Object.keys(CANDIDATE_BENGALI).length >= 250);
});

test('the public journey and sign-in surfaces use the shared translations', () => {
  const files = [
    'src/pages/PublicOnlyCareers.tsx',
    'src/pages/PublicJobsPage.tsx',
    'src/pages/VerifiedJobDetails.tsx',
    'src/pages/VerifiedApplyPage.tsx',
    'src/components/auth/AuthModal.tsx',
    'src/components/common/Navbar.tsx',
    'src/components/common/Footer.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /useCandidateLocale|CandidateLocaleSwitch/, `${file} should use shared locale support`);
  }
});
