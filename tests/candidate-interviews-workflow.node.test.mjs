import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { translateCandidateText } from '../src/lib/candidateLocale.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(path.join(root, 'src/pages/InterviewsPage.tsx'), 'utf8');

test('interview invitations preserve response actions while translating statuses, dates, and recovery', () => {
  assert.match(page, /useCandidateLocale/);
  assert.match(page, /respondToInterview\(activeInterview\.id, responseAction, candidateNotes, proposedAvailability\)/);
  assert.match(page, /status === 'pending'/);
  assert.match(page, /status === 'accepted'/);
  assert.match(page, /status === 'declined'/);
  assert.match(page, /status === 'reschedule_requested'/);
  assert.match(page, /status === 'completed'/);
  assert.match(page, /status === 'cancelled'/);
  assert.match(page, /date\.toLocaleDateString|Intl\.DateTimeFormat\(locale === 'bn' \? 'bn-BD' : 'en-US'/);
  assert.match(page, /role="alert"[^>]*>\{t\('Your interviews could not be loaded\. Please try again\.'\)\}/);
  assert.match(page, /catch \{[\s\S]*?setError\(t\('Failed to submit interview response\. Please try again\.'\)\)/);
  assert.match(page, /responseAction === 'reschedule_requested' && \(!candidateNotes\.trim\(\) \|\| !proposedAvailability\.trim\(\)\)/);
  assert.equal(translateCandidateText('No Interviews Scheduled', 'bn'), 'এখনও কোনো সাক্ষাৎকার নির্ধারিত হয়নি');
  assert.equal(translateCandidateText('({minutes} mins)', 'bn', { minutes: '৪৫' }), '(৪৫ মিনিট)');
  assert.equal(translateCandidateText('Interview Invitations', 'bn'), 'সাক্ষাৎকারের আমন্ত্রণ');
  assert.equal(translateCandidateText('Interview location:', 'bn'), 'সাক্ষাৎকারের স্থান:');
  assert.equal(translateCandidateText('Completed', 'bn'), 'সম্পন্ন');
  assert.equal(translateCandidateText('Cancelled', 'bn'), 'বাতিল');
});

test('interview cards expose physical locations and distinguish terminal statuses', () => {
  assert.match(page, /isCompleted\s*\?\s*t\('Completed'\)/);
  assert.match(page, /isCancelled\s*\?\s*t\('Cancelled'\)/);
  assert.match(page, /inv\.candidate_proposed_times && \(/);
  assert.match(page, /inv\.location && \(/);
  assert.match(page, /<MapPin aria-hidden="true"/);
  assert.match(page, /className="flex min-w-0 items-start gap-2"/);
  assert.match(page, /className="break-words text-slate-600"/);
});

test('interview response dialog has keyboard recovery, labelled controls, and mobile-sized actions', () => {
  assert.match(page, /role="dialog" aria-modal="true" aria-labelledby="interview-response-title" aria-describedby="interview-response-description"/);
  assert.match(page, /window\.requestAnimationFrame\(\(\) => responseDialogRef\.current\?\.focus\(\)\)/);
  assert.match(page, /event\.key === 'Escape'[\s\S]*?closeResponseDialog\(\)/);
  assert.match(page, /event\.shiftKey[\s\S]*?last\.focus\(\)/);
  assert.match(page, /previouslyFocused\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /htmlFor="candidate-interview-response-note"/);
  assert.match(page, /id="candidate-proposed-times"/);
  assert.match(page, /className="min-h-11 px-3 bg-white border border-slate-300/);
  assert.match(page, /className="min-h-11 px-3 bg-white border border-rose-200/);
  assert.match(page, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/);
});
