import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const workflow=readFileSync('.github/workflows/release-preview.yml','utf8');
const index=readFileSync('index.html','utf8');
const fallback=readFileSync('404.html','utf8');
test('Candidate Pages build has the correct repository base and compiled index',()=>{
 expect(workflow).toContain('vite build --base=/HRIS-Candidate-v2/');
 expect(workflow).toContain('test -s dist/index.html');
 expect(workflow).toContain('cp dist/index.html dist/404.html');
 expect(workflow).toContain('path: dist');
 expect(workflow).not.toContain('mv dist/app.html dist/index.html');
});
test('Production release does not push generated files into the source branch',()=>{
 expect(workflow).not.toContain('git push origin HEAD:main');
 expect(workflow).not.toContain('git add -A');
 expect(workflow).not.toContain('contents: write');
 expect(workflow).toContain('actions/deploy-pages@v4');
});
test('Deployment workflow checks served compiled assets',()=>{
 expect(workflow).toContain('Verify served HTML, compiled JavaScript and CSS');
 expect(workflow).toContain('test -s live.js && test -s live.css');
});
test('Canonical entry HTML and static fallback have valid repository paths',()=>{
 expect(index).toContain('</head>');
 expect(index).toContain('src="/src/main.tsx"');
 expect(index).toContain('id="root"');
 expect(fallback).toContain('/HRIS-Candidate-v2/');
 expect(fallback).not.toContain('/HRIS-Candidate/assets/');
});

test('C1 audit deliverables state the unverified gates explicitly',()=>{
 for (const file of ['C1_SOURCE_AUDIT.md','C1_SQL_INTEGRATION_MATRIX.md',
  'C1_UX_RESPONSIVE_AUDIT.md','C1_SECURITY_TEST_RESULTS.md','C1_RELEASE_ACCEPTANCE.md']) {
  const doc=readFileSync('docs/candidate/'+file,'utf8');
  expect(doc.length).toBeGreaterThan(350);
 }
 const security=readFileSync('docs/candidate/C1_SECURITY_TEST_RESULTS.md','utf8');
 expect(security).toContain('NOT CERTIFIED');
 const release=readFileSync('docs/candidate/C1_RELEASE_ACCEPTANCE.md','utf8');
 expect(release).toContain('NO-GO');
});

test('Production public-only build blocks unverified candidate actions',()=>{
 const workflow=readFileSync('.github/workflows/release-preview.yml','utf8');
 const app=readFileSync('src/App.tsx','utf8');
 const preview=readFileSync('src/pages/PublicOnlyCareers.tsx','utf8');
 expect(workflow).toContain("VITE_CANDIDATE_PUBLIC_ONLY: 'true'");
 expect(app).toContain("import.meta.env.VITE_CANDIDATE_PUBLIC_ONLY === 'true'");
 expect(preview).toContain('<PublicJobsPage publicOnly');
 expect(preview).toContain('<VerifiedJobDetails jobId={jobId} publicOnly');
 expect(preview).not.toContain('<AuthModal');
 expect(preview).not.toContain('VerifiedApplyPage');
});
test('Published hero and culture assets are compiled through Vite import, not root source URLs',()=>{
 const jobs=readFileSync('src/pages/PublicJobsPage.tsx','utf8');
 expect(jobs).toContain("import careersHero");
 expect(jobs).toContain("import cultureImage");
 expect(jobs).not.toContain('src="/src/assets/');
});

test('C1 protected screens recover from failed context loads',()=>{
 for (const file of ['ApplicationsPage.tsx','OffersPage.tsx','InterviewsPage.tsx','TasksPage.tsx','PreboardingPage.tsx']) {
  const page=readFileSync('src/pages/'+file,'utf8');
  expect(page).toContain('setLoadError(');
  expect(page).toContain('finally');
  expect(page).toContain('Retry</button>');
  expect(page).toContain('setLoading(false)');
 }
});

test('C1 public vacancies are deep-linkable without enabling candidate write actions',()=>{
 const page=readFileSync('src/pages/PublicOnlyCareers.tsx','utf8');
 expect(page).toContain("new URLSearchParams(window.location.search).get('job')");
 expect(page).toContain("window.history.pushState");
 expect(page).toContain("window.addEventListener('popstate'");
 expect(page).toContain('publicOnly');
 expect(page).not.toContain('VerifiedApplyPage');
});
test('Preboarding never prefills unverified personal or offer information',()=>{
 const page=readFileSync('src/pages/PreboardingPage.tsx','utf8');
 expect(page).not.toContain('1995-04-12');
 expect(page).not.toContain('Road 12, Banani');
 expect(page).not.toContain('Dutch-Bangla Bank PLC');
 expect(page).not.toContain('December 1, 2026');
 expect(page).not.toContain('Software Engineering Staff');
});
