import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/candidate-auth-postgres-acceptance.yml', import.meta.url), 'utf8');

test('Candidate Auth/RLS CI is disposable, development-only, least-privilege, and non-deploying', () => {
  assert.match(workflow, /branches: \[development\/hris-checkpoints\]/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/development\/hris-checkpoints'/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes: 45/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /git clone --depth 1 --branch development\/hris-checkpoints https:\/\/github\.com\/shihab-tech04\/HRIS-v2\.git/);
  assert.match(workflow, /node tests\/sql\/candidate-c1\/run-local-tenant-auth\.mjs/);
  assert.match(workflow, /node tests\/candidate-profile-local-e2e\.mjs/);
  assert.match(workflow, /node tests\/candidate-application-local-e2e\.mjs/);
  assert.match(workflow, /bun test \.\/tests\/\*\.test\.\*/);
  assert.match(workflow, /supabase start --workdir/);
  assert.match(workflow, /supabase stop --workdir .*--no-backup/);
  assert.doesNotMatch(workflow, /pull_request_target|deploy-pages|supabase\.co|secrets\./i);
  assert.match(workflow, /Generated local keys and service logs are suppressed/);
});
