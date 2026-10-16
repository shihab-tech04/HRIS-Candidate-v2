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

test('saved jobs and alerts copy is translated, including persisted notifications and notices', () => {
  const page = readFileSync(path.join(root, 'src/pages/VerifiedSavedJobsPage.tsx'), 'utf8');
  const keys = [...page.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map(match => match[1]);
  assert.ok(keys.length >= 40, 'Saved jobs and alerts should route visible copy through the shared locale translator.');
  for (const key of keys) {
    const normalized = key.replace(/\\'/g, "'");
    assert.ok(CANDIDATE_BENGALI[normalized], `Missing Bengali translation for saved-jobs copy: ${normalized}`);
    assert.notEqual(CANDIDATE_BENGALI[normalized], normalized, `Translation is still English: ${normalized}`);
  }
  assert.equal(translateCandidateText('Apply by {date}', 'bn', { date: '2026-10-16' }), '2026-10-16-এর মধ্যে আবেদন করুন');
  assert.equal(translateCandidateText('“{title}” was removed.', 'bn', { title: 'Dhaka roles' }), '“Dhaka roles” সরানো হয়েছে।');
  assert.equal(translateCandidateText('New job matches your alert', 'bn'), 'নতুন চাকরি আপনার সতর্কতার সঙ্গে মিলেছে');
  assert.equal(translateCandidateText('{title} matches your job alert.', 'bn', { title: 'Systems Engineer' }), 'Systems Engineer আপনার চাকরির সতর্কতার সঙ্গে মিলেছে।');
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
    'src/pages/VerifiedSavedJobsPage.tsx',
    'src/components/auth/AuthModal.tsx',
    'src/components/common/Navbar.tsx',
    'src/components/common/Footer.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /useCandidateLocale|CandidateLocaleSwitch/, `${file} should use shared locale support`);
  }
});

test('offer and preboarding interface copy is bilingual while persisted terms and payload values stay unchanged', () => {
  for (const [file, minimumKeys] of [
    ['src/pages/OffersPage.tsx', 40],
    ['src/pages/PreboardingPage.tsx', 55],
  ]) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /useCandidateLocale/, `${file} should use the persisted shared locale`);
    const keys = [...source.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map(match => match[1].replace(/\\'/g, "'"));
    assert.ok(keys.length >= minimumKeys, `${file} should translate its visible static interface copy`);
    for (const key of keys) {
      assert.ok(CANDIDATE_BENGALI[key], `Missing Bengali translation for ${file}: ${key}`);
      assert.notEqual(CANDIDATE_BENGALI[key], key, `Translation is still English for ${file}: ${key}`);
    }
  }

  const offers = readFileSync(path.join(root, 'src/pages/OffersPage.tsx'), 'utf8');
  const preboarding = readFileSync(path.join(root, 'src/pages/PreboardingPage.tsx'), 'utf8');
  assert.match(offers, /respondToOffer\(\s*selectedOffer\.id,\s*responseType,\s*signatureText\.trim\(\),\s*responseNotes\.trim\(\)/);
  assert.match(offers, /\{offer\.terms\}</);
  assert.match(offers, /\{b\}/);
  assert.match(preboarding, /updateOnboardingHandoff\(handoff\.application_id, stepKey, formData\)/);
  assert.match(preboarding, /<option value="Spouse">\{t\('Spouse'\)\}<\/option>/);
  assert.equal(translateCandidateText('Department: {department} · Reference ID: {reference}', 'bn', { department: 'Research', reference: 'O-17' }), 'বিভাগ: Research · রেফারেন্স আইডি: O-17');
  assert.equal(translateCandidateText('Complete each required field before saving this step.', 'bn'), 'সংরক্ষণ করার আগে প্রতিটি আবশ্যিক ঘর পূরণ করুন।');
  assert.equal(translateCandidateText('Complete each required field: {fields}', 'bn', { fields: 'national_id, date_of_birth' }), 'প্রতিটি আবশ্যিক ঘর পূরণ করুন: national_id, date_of_birth');
  assert.match(preboarding, /message === 'Complete each required field before saving this step\\.'/);
});
