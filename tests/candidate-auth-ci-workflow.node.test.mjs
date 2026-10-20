import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/candidate-auth-postgres-acceptance.yml', import.meta.url), 'utf8');
const releaseWorkflow = readFileSync(new URL('../.github/workflows/release-preview.yml', import.meta.url), 'utf8');

test('Candidate Auth/RLS CI is disposable, trusted-branch/manual release, least-privilege, and non-deploying', () => {
  assert.match(workflow, /branches: \[development\/hris-checkpoints, release\/candidate-stable-20261017, work\/candidate-phase06-07-20261020\]/);
  assert.match(workflow, /main_ref:[\s\S]*?default: development\/hris-checkpoints/);
  assert.match(workflow, /github\.event_name == 'push' && \(github\.ref == 'refs\/heads\/release\/candidate-stable-20261017' \|\| github\.ref == 'refs\/heads\/work\/candidate-phase06-07-20261020'\)/);
  assert.match(workflow, /HRIS_MAIN_REF: \$\{\{ github\.ref == 'refs\/heads\/release\/candidate-stable-20261017' && 'release\/hris-stable-20261017' \|\| inputs\.main_ref \|\| 'development\/hris-checkpoints' \}\}/);
  assert.match(workflow, /git clone --depth 1 --branch "\$HRIS_MAIN_REF"/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes: 45/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /Record the trusted HRIS source revision used for Candidate security fixtures/);
  assert.match(workflow, /git -C "\$HRIS_MAIN_REPO_ROOT" rev-parse HEAD/);
  assert.match(workflow, /node tests\/sql\/candidate-c1\/run-local-tenant-auth\.mjs/);
  assert.match(workflow, /node tests\/candidate-profile-local-e2e\.mjs/);
  assert.match(workflow, /node tests\/candidate-application-local-e2e\.mjs/);
  assert.match(workflow, /bun test \.\/tests\/\*\.test\.\*/);
  assert.match(workflow, /supabase start --workdir/);
  assert.match(workflow, /supabase stop --workdir .*--no-backup/);
  assert.doesNotMatch(workflow, /pull_request_target|deploy-pages|supabase\.co|secrets\./i);
  assert.match(workflow, /Generated local keys and service logs are suppressed/);
});

test('Candidate Pages deployment is manual, main-only, and requires explicit release approval', () => {
  assert.match(releaseWorkflow, /workflow_dispatch:\s+inputs:\s+release_approved:[\s\S]*?required: true[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.doesNotMatch(releaseWorkflow, /^\s+push:/m);
  assert.match(releaseWorkflow, /if: github\.ref == 'refs\/heads\/main' && inputs\.release_approved == true/);
  assert.match(releaseWorkflow, /permissions:\s+contents: read/);
  assert.match(releaseWorkflow, /deploy:[\s\S]*?permissions:\s+pages: write\s+id-token: write/);
});
