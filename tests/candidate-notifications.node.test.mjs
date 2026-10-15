import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const locale = readFileSync(new URL('../src/lib/candidateLocale.ts', import.meta.url), 'utf8');

test('verified candidate dashboard loads notifications through the owner-scoped table contract', () => {
  assert.match(api, /listVerifiedCandidateNotifications\(userId\)/);
  assert.match(api, /notification_load_error = true/);
  assert.match(api, /return \{ \.\.\.context, notifications, notification_load_error, onboarding: null \}/);
  assert.match(api, /candidate_notifications[\s\S]*?\.eq\('candidate_user_id', userId\)/);
  assert.match(api, /related_application_id,related_job_id,action_view,is_read,created_at/);
  assert.match(api, /markVerifiedCandidateNotificationRead[\s\S]*?update\(\{ is_read: true \}\)/);
});

test('dashboard opens the linked application and retains a retryable read-state failure', () => {
  assert.match(dashboard, /candidateNotificationRoute\(n\)/);
  assert.match(dashboard, /onSelectApplication\(route\.applicationId\)/);
  assert.match(dashboard, /markVerifiedCandidateNotificationRead/);
  assert.match(dashboard, /data\?\.notification_load_error/);
  assert.match(dashboard, /Unable to update this notification\./);
});

test('candidate notification status and actions have English and Bengali labels', () => {
  for (const phrase of ['Application update', 'Open application', 'Open job alerts', 'Mark read', 'Unread']) {
    assert.ok(locale.includes(phrase), 'Missing locale entry: ' + phrase);
  }
  assert.match(locale, /'Application update':\s*'[^']+'/);
  assert.match(locale, /'Mark read':\s*'[^']+'/);
});
