import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const appUrl = process.env.CANDIDATE_UI_TEST_URL || 'http://127.0.0.1:4175/HRIS-Candidate-v2/';
const apiOrigin = new URL(appUrl).origin;
const evidenceDir = process.env.CANDIDATE_UI_EVIDENCE_DIR || 'ui-evidence';
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1920, height: 1080 },
];

// Used only by the isolated browser test to check responsive card/detail behavior.
// The fixture is never written, never captured in screenshots, and is explicitly
// labeled as synthetic in the rendered test-only page.
const testOnlyJob = {
  id: 'ui-fixture-only-not-a-real-vacancy',
  title: 'TEST ONLY — synthetic UI fixture (not a real vacancy)',
  department: 'Engineering',
  location: 'TEST ONLY',
  workplace_type: 'Hybrid',
  employment_type: 'Full-time',
  summary: 'Browser-test fixture only. This is not a real Synesis vacancy.',
  responsibilities: ['TEST ONLY'],
  requirements: ['TEST ONLY'],
  benefits: [],
  salary_is_public: false,
  vacancy_count: 1,
  application_deadline: '2099-12-31T23:59:59.000Z',
  status: 'published',
  is_published: true,
  is_active: true,
  published_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  screening_questions: [],
  required_documents: [],
};
const testOnlyJobs = [
  testOnlyJob,
  ...Array.from({ length: 5 }, (_, index) => ({
    ...testOnlyJob,
    id: 'ui-fixture-only-not-a-real-vacancy-' + (index + 2),
    title: 'TEST ONLY — synthetic UI fixture ' + (index + 2) + ' (not a real vacancy)',
  })),
];
const testOnlyExpiredJob = {
  ...testOnlyJob,
  id: 'ui-fixture-expired-not-a-real-vacancy',
  title: 'TEST ONLY — expired synthetic vacancy (not a real vacancy)',
  application_deadline: '2000-01-01',
};

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

function isJobsResponse(response) {
  return response.url().includes('/rest/v1/candidate_published_jobs');
}

async function installReadOnlyApiMock(page, initialMode = 'empty') {
  let mode = initialMode;
  const requests = [];
  const blockedRequests = [];
  for (const service of ['auth', 'storage', 'functions']) {
    await page.route(apiOrigin + '/' + service + '/v1/**', async route => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      blockedRequests.push({ method: request.method(), path: requestUrl.pathname });
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"UI test permits published-vacancy reads only"}' });
    });
  }
  await page.route(`${apiOrigin}/rest/v1/**`, async route => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
        },
      });
      return;
    }
    if (requestUrl.pathname !== '/rest/v1/candidate_published_jobs' || request.method() !== 'GET') {
      blockedRequests.push({ method: request.method(), path: requestUrl.pathname });
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"UI test permits public vacancy reads only"}' });
      return;
    }

    requests.push(requestUrl.toString());
    if (mode === 'delay') await new Promise(resolve => setTimeout(resolve, 1800));
    if (mode === 'error') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"message":"isolated UI test error; no service data returned"}',
      });
      return;
    }
    const rows = mode === 'fixture' ? [...testOnlyJobs, testOnlyExpiredJob] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  return {
    requests,
    blockedRequests,
    setMode(nextMode) { mode = nextMode; },
  };
}

async function waitForVacanciesState(page, state = 'empty') {
  if (state === 'empty') {
    await page.getByRole('heading', { name: 'No vacancies found' }).waitFor({ state: 'visible', timeout: 15_000 });
  } else if (state === 'error') {
    await page.getByRole('alert').filter({ hasText: 'Unable to verify published vacancies' }).waitFor({ state: 'visible', timeout: 15_000 });
  } else if (state === 'loading') {
    await page.getByText('Fetching active vacancies...').waitFor({ state: 'visible', timeout: 5_000 });
  }
}

async function verifyNoOverflow(page, viewport) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyTextLength: document.body.innerText.trim().length,
  }));
  assert.ok(dimensions.documentWidth <= viewport.width + 1, `horizontal overflow: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.bodyTextLength > 300, `render is unexpectedly empty: ${JSON.stringify(dimensions)}`);
  return dimensions;
}

async function captureRendered(page, viewport, fileName) {
  const dimensions = await verifyNoOverflow(page, viewport);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0), null, { timeout: 15_000 });
  const path = join(evidenceDir, fileName);
  const png = await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'screenshot is not a PNG');
  assert.equal(png.readUInt32BE(16), viewport.width, 'screenshot width does not match the tested viewport');
  assert.ok(png.readUInt32BE(20) > viewport.height, 'full-page screenshot height is unexpectedly blank');
  assert.ok(png.byteLength > 20_000, `screenshot is unexpectedly small: ${png.byteLength} bytes`);
  console.log(`PASS rendered ${fileName}: ${viewport.width}x${png.readUInt32BE(20)}, ${png.byteLength} bytes, document width ${dimensions.documentWidth}`);
}

try {
  // Empty public results are used for all screenshots. No sample vacancy data is
  // shown in the artifact; unavailable private actions remain behind the gate.
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const api = await installReadOnlyApiMock(page);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    const response = await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assert.equal(response?.status(), 200, `public page returned HTTP ${response?.status()}`);
    await page.getByRole('heading', { name: 'Build Mission-Critical Platforms That Move Nations Forward' }).waitFor({ state: 'visible' });
    await page.getByRole('textbox', { name: 'Search vacancies' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Find Vacancies' }).waitFor({ state: 'visible' });
    await waitForVacanciesState(page);
    assert.ok(api.requests.length > 0, 'public published-vacancy read was not intercepted');

    const englishText = await page.locator('body').innerText();
    assert.ok(!englishText.includes(testOnlyJob.title), 'test-only vacancy leaked into empty-state screenshot');
    assert.ok(!englishText.includes('Senior Full-Stack Engineer (TypeScript & Cloud)'), 'sample vacancy data leaked into public view');
    await captureRendered(page, viewport, `candidate-public-en-${viewport.width}.png`);

    await page.getByRole('button', { name: 'Switch to Bengali' }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'bn');
    const bengaliFontLoaded = await page.evaluate(async () => {
      const loaded = await document.fonts.load('400 16px "Noto Sans Bengali Variable"', 'বাংলা');
      return loaded.length > 0 && document.fonts.check('400 16px "Noto Sans Bengali Variable"', 'বাংলা');
    });
    assert.equal(bengaliFontLoaded, true, 'local Bengali font did not load');
    assert.equal(
      (await page.locator('h1').innerText()).trim(),
      'দেশের অগ্রযাত্রায় গুরুত্বপূর্ণ ডিজিটাল প্ল্যাটফর্ম তৈরি করুন',
      'Bengali public hero translation did not render',
    );
    await page.getByRole('heading', { name: 'কোনো চাকরির বিজ্ঞপ্তি পাওয়া যায়নি' }).waitFor({ state: 'visible' });
    await captureRendered(page, viewport, `candidate-public-bn-${viewport.width}.png`);
    assert.equal(pageErrors.length, 0, `browser runtime errors: ${pageErrors.join('; ')}`);
    await page.close();
  }

  // Exercise keyboard order, focus visibility, filters and search without a data
  // record or a successful submission.
  {
    const viewport = viewports[0];
    const page = await browser.newPage({ viewport });
    const api = await installReadOnlyApiMock(page);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await waitForVacanciesState(page);
    assert.equal(await page.getByRole('search', { name: 'Search vacancies' }).count(), 1, 'vacancy search is missing a named search landmark');
    assert.equal(await page.getByRole('group', { name: 'Department:' }).count(), 1, 'department filters are missing a named control group');
    await page.keyboard.press('Tab');
    assert.equal((await page.locator(':focus').innerText()).trim(), 'Synesis Careers', 'keyboard focus did not start at the brand control');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
    assert.equal(outline, '2px', 'keyboard focus indicator is not visible on the first control');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Switch to Bengali', 'language switch is missing from keyboard order');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Search vacancies', 'search is missing from keyboard order');
    await page.keyboard.type('no matching vacancy');
    const responseWait = page.waitForResponse(isJobsResponse);
    await page.keyboard.press('Enter');
    await responseWait;
    await waitForVacanciesState(page);

    const department = page.getByRole('button', { name: 'Engineering', exact: true });
    const departmentResponse = page.waitForResponse(isJobsResponse);
    await department.click();
    await departmentResponse;
    assert.equal(await department.getAttribute('aria-pressed'), 'true', 'department selection is not announced');

    const workplaceResponse = page.waitForResponse(isJobsResponse);
    await page.getByRole('combobox', { name: 'Workplace type' }).selectOption('Remote');
    await workplaceResponse;
    assert.equal(await page.getByRole('combobox', { name: 'Workplace type' }).inputValue(), 'Remote');

    const employmentResponse = page.waitForResponse(isJobsResponse);
    await page.getByRole('combobox', { name: 'Employment type' }).selectOption('Contract');
    await employmentResponse;
    assert.equal(await page.getByRole('combobox', { name: 'Employment type' }).inputValue(), 'Contract');
    assert.equal(api.blockedRequests.length, 0, `unexpected API request: ${JSON.stringify(api.blockedRequests)}`);
    console.log('PASS keyboard order/focus, EN/BN switch, search submit, department and select filters');
    await page.close();
  }

  // Loading, error, retry-to-empty, and unavailable-detail states are rendered
  // from read-only intercepted requests with no real records.
  {
    const viewport = viewports[0];
    const page = await browser.newPage({ viewport });
    const api = await installReadOnlyApiMock(page);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await waitForVacanciesState(page);

    api.setMode('delay');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForVacanciesState(page, 'loading');
    await captureRendered(page, viewport, 'candidate-public-loading-375.png');
    await waitForVacanciesState(page);

    api.setMode('error');
    await page.getByRole('textbox', { name: 'Search vacancies' }).fill('isolated error state');
    let nextResponse = page.waitForResponse(isJobsResponse);
    await page.getByRole('button', { name: 'Find Vacancies' }).click();
    await nextResponse;
    await waitForVacanciesState(page, 'error');
    assert.equal(await page.getByRole('heading', { name: 'No vacancies found' }).count(), 0, 'service failure was presented as an empty vacancy result');
    await captureRendered(page, viewport, 'candidate-public-error-375.png');

    api.setMode('empty');
    nextResponse = page.waitForResponse(isJobsResponse);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await nextResponse;
    await waitForVacanciesState(page);
    await captureRendered(page, viewport, 'candidate-public-empty-375.png');

    const detailUrl = new URL(appUrl);
    detailUrl.searchParams.set('job', 'not-a-published-job');
    await page.goto(detailUrl.toString(), { waitUntil: 'domcontentloaded' });
    await page.getByText('Vacancy not available or cannot be verified.').waitFor({ state: 'visible' });
    await captureRendered(page, viewport, 'candidate-public-detail-unavailable-375.png');
    await page.getByRole('button', { name: 'Back to jobs' }).click();
    assert.equal(new URL(page.url()).searchParams.has('job'), false, 'back action did not clear the job URL');
    await waitForVacanciesState(page);
    assert.equal(api.blockedRequests.length, 0, `unexpected API request: ${JSON.stringify(api.blockedRequests)}`);
    console.log('PASS loading, service error, empty recovery, deep-link details and back navigation');
    await page.close();
  }

  // A visibly labeled fixture is used only for un-captured card and detail checks.
  // It proves the public gate disables Apply/Save and sends no mutation requests.
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const api = await installReadOnlyApiMock(page, 'fixture');
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    const testListing = page.getByRole('button', { name: `View vacancy: ${testOnlyJob.title}` });
    await testListing.waitFor({ state: 'visible' });
    await verifyNoOverflow(page, viewport);
    assert.equal(
      await page.getByRole('button', { name: /View vacancy: TEST ONLY/ }).count(),
      testOnlyJobs.length,
      'public list silently truncated active results without an accepted pagination contract',
    );
    assert.equal(
      await page.getByRole('button', { name: 'View vacancy: ' + testOnlyExpiredJob.title }).count(),
      0,
      'expired vacancy appeared in the public listing',
    );

    await page.getByRole('textbox', { name: 'Search vacancies' }).fill('no matching synthetic vacancy');
    let searchResponse = page.waitForResponse(isJobsResponse);
    await page.getByRole('button', { name: 'Find Vacancies' }).click();
    await searchResponse;
    await waitForVacanciesState(page);
    assert.equal(await testListing.count(), 0, 'empty search kept a non-matching vacancy visible');
    const searchResetResponse = page.waitForResponse(isJobsResponse);
    await page.getByRole('button', { name: 'Reset All Filters' }).click();
    await searchResetResponse;
    await testListing.waitFor({ state: 'visible' });

    const unmatchedFilter = page.waitForResponse(isJobsResponse);
    await page.getByRole('button', { name: 'Product & Design', exact: true }).click();
    await unmatchedFilter;
    await waitForVacanciesState(page);
    const resetResponse = page.waitForResponse(isJobsResponse);
    await page.getByRole('button', { name: 'Reset All Filters' }).click();
    await resetResponse;
    await testListing.waitFor({ state: 'visible' });

    const keyboardListing = page.getByRole('button', { name: 'View vacancy: ' + testOnlyJobs[testOnlyJobs.length - 1].title });
    await keyboardListing.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: testOnlyJobs[testOnlyJobs.length - 1].title }).waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).searchParams.get('job'), testOnlyJobs[testOnlyJobs.length - 1].id, 'keyboard vacancy navigation did not update the deep link');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1', 'detail navigation did not move keyboard focus to the vacancy heading');
    assert.ok((await page.evaluate(() => window.scrollY)) <= 1, 'detail navigation did not reset scroll to the top');
    const apply = page.getByRole('button', { name: 'Apply', exact: true });
    const save = page.getByRole('button', { name: /Save .* for later/ });
    assert.equal(await apply.isDisabled(), true, 'Apply is available in the public-only detail view');
    assert.equal(await save.isDisabled(), true, 'Save is available in the public-only detail view');
    assert.ok((await apply.getAttribute('aria-describedby'))?.includes('candidate-public-safety-notice'));
    assert.ok((await save.getAttribute('aria-describedby'))?.includes('candidate-public-safety-notice'));
    await verifyNoOverflow(page, viewport);

    const back = page.getByRole('button', { name: 'Back to jobs' });
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Back to jobs', 'keyboard focus did not reach the detail back action');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth), '2px', 'detail back action lacks a visible focus indicator');
    await back.press('Enter');
    assert.equal(new URL(page.url()).searchParams.has('job'), false, 'card detail back action did not clear the job URL');
    await testListing.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement?.id === 'candidate-careers-heading');
    assert.ok((await page.evaluate(() => window.scrollY)) <= 1, 'back navigation did not reset scroll to the top');

    await keyboardListing.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: testOnlyJobs[testOnlyJobs.length - 1].title }).waitFor({ state: 'visible' });
    await page.goBack();
    await testListing.waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).searchParams.has('job'), false, 'browser back did not restore the vacancy list');
    await page.waitForFunction(() => document.activeElement?.id === 'candidate-careers-heading');

    const expiredDetailUrl = new URL(appUrl);
    expiredDetailUrl.searchParams.set('job', testOnlyExpiredJob.id);
    await page.goto(expiredDetailUrl.toString(), { waitUntil: 'domcontentloaded' });
    await page.getByText('Vacancy not available or cannot be verified.').waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'expired deep link exposed an application action');

    if (viewport.width === 375) {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Switch to Bengali' }).click();
      await page.waitForFunction(() => document.documentElement.lang === 'bn');
      const bengaliDetailUrl = new URL(appUrl);
      bengaliDetailUrl.searchParams.set('job', testOnlyJob.id);
      await page.goto(bengaliDetailUrl.toString(), { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: testOnlyJob.title }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('html').getAttribute('lang'), 'bn', 'vacancy detail did not preserve the Bengali locale');
      assert.equal(await page.getByRole('button', { name: 'আবেদন করুন', exact: true }).isDisabled(), true, 'Bengali public detail enabled Apply');
      assert.equal(await page.getByRole('button', { name: 'TEST ONLY — synthetic UI fixture (not a real vacancy) পরে দেখার জন্য সংরক্ষণ করুন' }).isDisabled(), true, 'Bengali public detail enabled Save');
      await page.getByRole('button', { name: 'চাকরির তালিকায় ফিরুন', exact: true }).waitFor({ state: 'visible' });
    }
    assert.equal(api.blockedRequests.length, 0, `public view attempted a non-vacancy API request: ${JSON.stringify(api.blockedRequests)}`);
    await page.close();
  }
  console.log('PASS responsive vacancy cards/details and disabled Apply/Save across 375/768/1280/1920; test fixture was not captured');

  // Direct Candidate route attempts must remain in the public-only shell in both locales.
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const api = await installReadOnlyApiMock(page);
    const views = ['dashboard', 'applications', 'cv-builder', 'interviews', 'tasks', 'offers', 'preboarding', 'profile', 'saved-jobs', 'apply', 'signup', 'about'];
    for (const locale of ['en', 'bn']) {
      if (locale === 'bn') {
        await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Switch to Bengali' }).click();
        await page.waitForFunction(() => document.documentElement.lang === 'bn');
      }
      for (const view of views) {
        const routeUrl = new URL(appUrl);
        routeUrl.searchParams.set('view', view);
        await page.goto(routeUrl.toString(), { waitUntil: 'domcontentloaded' });
        const expectedHeading = locale === 'bn'
          ? 'দেশের অগ্রযাত্রায় গুরুত্বপূর্ণ ডিজিটাল প্ল্যাটফর্ম তৈরি করুন'
          : 'Build Mission-Critical Platforms That Move Nations Forward';
        await page.getByRole('heading', { name: expectedHeading }).waitFor({ state: 'visible' });
        assert.equal(await page.locator('html').getAttribute('lang'), locale, `locale was lost for ${view}`);
        assert.equal(await page.locator('input[type="password"]').count(), 0, `private registration/auth UI opened for ${view}`);
        assert.equal(await page.getByRole('heading', { name: /Candidate Dashboard/i }).count(), 0, `private dashboard opened for ${view}`);
      }
    }
    assert.equal(api.blockedRequests.length, 0, `private route attempted protected API access: ${JSON.stringify(api.blockedRequests)}`);
    console.log('PASS EN/BN public-only route gate: dashboard, registration, CV, applications, interviews, tasks, offers, preboarding, profile, saved jobs, apply, about');
    await page.close();
  }
} finally {
  await browser.close();
}
