import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.CANDIDATE_UI_TEST_URL || 'http://127.0.0.1:4175/HRIS-Candidate-v2/';
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1920, height: 1080 },
];
const browser = await chromium.launch({ headless: true });
await mkdir('ui-evidence', { recursive: true });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    try {
      await page.getByRole('heading', {
        name: 'Build Mission-Critical Platforms That Move Nations Forward',
      }).waitFor({ state: 'visible', timeout: 20_000 });
      await page.getByRole('button', { name: 'Find Vacancies' }).waitFor({ state: 'visible', timeout: 10_000 });
      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        headingText: document.querySelector('h1')?.textContent?.trim().slice(0, 100) || '',
      }));
      if (dimensions.documentWidth > viewport.width + 1) {
        throw new Error(`Horizontal document overflow: ${JSON.stringify(dimensions)}`);
      }
      const name = `ui-evidence/candidate-public-${viewport.width}.png`;
      await page.screenshot({ path: name, fullPage: true });
      console.log(`PASS ${viewport.width}x${viewport.height} public Candidate: HTTP ${response?.status()}, viewport ${dimensions.viewportWidth}, document ${dimensions.documentWidth}; ${name}`);
    } catch (error) {
      const body = await page.locator('body').innerText().catch(() => '[body unavailable]');
      throw new Error(`Candidate public UI failed at ${viewport.width}x${viewport.height}: ${String(error)}; HTTP ${response?.status()}; body=${body.slice(0, 350)}; browserErrors=${JSON.stringify(errors.slice(0, 5))}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
