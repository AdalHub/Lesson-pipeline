/** Read-only post-cleanup UI acceptance; no AI calls or new submissions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

async function main() {
  const base = process.env.BASE_URL ?? 'https://lesson-pipeline.vercel.app';
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/lessons`);
    const links = page.locator('main ul > li a');
    assert.equal(await links.count(), 6);
    fs.mkdirSync('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/final-history.png', fullPage: true });
    const hrefs = await links.evaluateAll(elements => elements.map(el => el.getAttribute('href')!));
    for (const href of hrefs) {
      const response = await page.goto(`${base}${href}`);
      assert.equal(response?.status(), 200);
      await page.getByRole('heading', { name: 'How it works' }).waitFor();
      assert.equal(await page.locator('details[open]').count(), 0);
      await page.getByText('Why this classification?').click();
      assert(await page.getByText('Grounded classification').isVisible());
      assert(await page.getByRole('link', { name: 'Selected TEKS record' }).count() > 0);
    }
    assert.equal((await page.goto(`${base}/lessons/07140759-a8ed-419b-84bb-f05b3a703f42`))?.status(), 404);
    assert.deepEqual(errors, []);
    console.log('PASS: clean history has 6 examples; every lesson and source panel loads; removed old link returns 404.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
