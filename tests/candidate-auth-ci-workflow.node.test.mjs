import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/candidate-auth-postgres-acceptance.yml', import.meta.url), 'utf8');
const releaseWorkflow = readFileSync(new URL('../.github/workflows/release-preview.yml', import.meta.url), 'utf8');
const applicationE2E = readFileSync(new URL('./candidate-application-local-e2e.mjs', import.meta.url), 'utf8');

test('Candidate Auth/RLS CI pins the protected Main contract and stays local-only', () => {
  assert.match(workflow, /pull_request:\s+branches: \[main\][\s\S]*?paths:/);
  assert.ok(workflow.includes("HRIS_MAIN_REF: '3e20cf89faa96ad8caecd1f7b93c28a6b117032c'"),
    "Candidate acceptance must use the exact protected Main SQL contract");
  assert.match(workflow, /github\.event_name == 'pull_request'/);
  assert.match(workflow, /git clone --quiet --depth 1 --no-checkout https:\/\/github\.com\/shihab-tech04\/HRIS-v2\.git/);
  assert.match(workflow, /git -C "\$HRIS_MAIN_REPO_ROOT" fetch --no-tags --depth 1 origin "\$HRIS_MAIN_REF"/);
  assert.match(workflow, /checkout --detach FETCH_HEAD/);
  assert.match(workflow, /test "\$\(git -C "\$HRIS_MAIN_REPO_ROOT" rev-parse HEAD\)" = "\$HRIS_MAIN_REF"/);
  assert.ok(workflow.includes("branches: [development/hris-checkpoints, release/candidate-stable-20261017, work/candidate-phase06-07-20261020, integration/ws05-candidate-final-review-20261022, integration/ws05-candidate-nav-e2e-review-20261023]"),
    "Existing explicitly permitted disposable push branches must remain intact");
  assert.match(workflow, /github\.event_name == 'push' && \(github\.ref == 'refs\/heads\/release\/candidate-stable-20261017' \|\| github\.ref == 'refs\/heads\/work\/candidate-phase06-07-20261020'\)/);
  assert.match(workflow, /group: candidate-disposable-acceptance-\$\{\{ github\.ref \}\}/);
  assert.match(workflow, /cancel-in-progress: true/);
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
  assert.doesNotMatch(workflow, /pull_request_target|deploy-pages|supabase\.co|VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|secrets\./i);
  assert.match(workflow, /Generated local keys and service logs are suppressed/);

  assert.match(applicationE2E, /20261026060240_candidate_screening_answer_validation\.sql/);
  assert.match(applicationE2E, /type: 'short_text'/);
  assert.match(applicationE2E, /invalidScreening\.error\?\.code === '22000'/);
  assert.match(applicationE2E, /missingDocument\.error\?\.code === '22000'/);
  assert.match(applicationE2E, /rpc\('candidate_apply_to_job', applicationRpcArgs\)/);
  assert.match(applicationE2E, /persistedAfterReplay\.data\.length === 1/);
});
test('Candidate Pages deployment is manual, main-only, and requires explicit release approval', () => {
  assert.match(releaseWorkflow, /workflow_dispatch:\s+inputs:\s+release_approved:[\s\S]*?required: true[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.doesNotMatch(releaseWorkflow, /^\s+push:/m);
  assert.match(releaseWorkflow, /if: github\.ref == 'refs\/heads\/main' && inputs\.release_approved == true/);
  assert.match(releaseWorkflow, /permissions:\s+contents: read/);
  assert.match(releaseWorkflow, /deploy:[\s\S]*?permissions:\s+pages: write\s+id-token: write/);
});
