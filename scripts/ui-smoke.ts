/**
 * Milestones 7 + 8 smoke test: drive the real UI in headless Chrome.
 *
 *  1. Paste a grade-2 text question, watch the stage indicator, land on the lesson page.
 *  2. Open History, click the newest item.
 *  3. Render a worksheet-style question to a real PNG screenshot, upload it via the
 *     file picker, and verify a classification + lesson come back.
 *  4. Paste the same PNG from the clipboard (synthetic paste event) and verify the preview appears.
 *  5. Submit a grade-10 text question so the reading-level comparison exists in the DB.
 *
 * Run: npm run smoke:ui [-- <outputDir>]   (server must be running on BASE_URL, default :3000)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const outDir = path.resolve(process.argv[2] ?? 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const GRADE2 =
  'Jamal has 34 stickers. His sister gives him 25 more stickers. How many stickers does Jamal have now?';
const GRADE10 = 'Write the equation of a circle with center (3, -2) and radius 5.';

const WORKSHEET_HTML = `<!doctype html><html><body style="margin:0;background:#fff">
<div id="q" style="width:720px;padding:28px 36px;font-family:Georgia,serif;color:#111;background:#fff">
  <div style="font:bold 13px Arial;color:#555;letter-spacing:.08em">GRADE 6 MATHEMATICS &nbsp;·&nbsp; UNIT 3 QUIZ</div>
  <div style="margin-top:14px;font-size:20px"><b>7.</b> Evaluate the expression.</div>
  <div style="margin:14px 0 18px 28px;font-size:26px">3 + 2<sup style="font-size:15px">3</sup> × (10 − 4) ÷ 4</div>
  <div style="margin-left:28px;font-size:19px;line-height:1.8">
    <div><b>A</b>&nbsp; 11</div><div><b>B</b>&nbsp; 15</div><div><b>C</b>&nbsp; 18</div><div><b>D</b>&nbsp; 24</div>
  </div>
</div></body></html>`;

const shot = (page: Page, name: string, fullPage = true) =>
  page.screenshot({ path: path.join(outDir, name), fullPage });

async function readBadges(page: Page) {
  const grade = await page.locator('span', { hasText: /\d+(st|nd|rd|th) grade/ }).first().textContent();
  const teks = await page.locator('span', { hasText: /^TEKS / }).first().textContent();
  const conf = await page.locator('span', { hasText: /confidence$/ }).first().textContent();
  const title = await page.locator('h1').first().textContent();
  return { grade: grade?.trim(), teks: teks?.trim(), confidence: conf?.trim(), title: title?.trim() };
}

async function submitAndWait(page: Page) {
  await page.getByRole('button', { name: 'Generate lesson' }).click();
  await page.getByText('Classifying against TEKS').waitFor({ timeout: 15_000 });
  const stage1Ms = Date.now();
  await shot(page, 'stage-1-classifying.png', false);
  let sawStage2 = false;
  try {
    await page
      .locator('li', { hasText: 'Writing the lesson' })
      .locator('.animate-spin')
      .waitFor({ timeout: 30_000 });
    sawStage2 = true;
    console.log(`  stage 2 became active after ${Date.now() - stage1Ms} ms`);
    await shot(page, 'stage-2-writing.png', false);
  } catch {
    console.log('  stage 2 not observed before navigation');
  }
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/, { timeout: 180_000 });
  await page.getByText('Objective:').waitFor();
  return { url: page.url(), sawStage2 };
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [console.error]', m.text());
  });

  // 1. Text question
  console.log('1. text submission (grade 2)');
  await page.goto(baseUrl + '/');
  await shot(page, '1-home.png');
  await page.locator('textarea').fill(GRADE2);
  const text = await submitAndWait(page);
  await shot(page, '2-lesson-grade2.png');
  console.log('  url:', text.url);
  console.log('  badges:', await readBadges(page));
  console.log('  open <details> on load:', await page.locator('details[open]').count());
  await page.getByText('Show answer').first().click();
  console.log('  open <details> after click:', await page.locator('details[open]').count());

  // 2. History
  console.log('2. history');
  await page.goto(baseUrl + '/lessons');
  await shot(page, '3-history.png');
  const items = await page.locator('main ul > li').count();
  console.log('  items on first page:', items);
  const firstTitle = await page.locator('main ul > li a p').first().textContent();
  await page.locator('main ul > li a').first().click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
  console.log('  clicked:', firstTitle?.trim(), '->', page.url());
  await page.getByText('Objective:').waitFor();

  // 3. Real screenshot -> upload via file picker
  console.log('3. image submission via file picker');
  const worksheet = await browser.newPage({ viewport: { width: 800, height: 400 } });
  await worksheet.setContent(WORKSHEET_HTML);
  const pngPath = path.join(outDir, 'question-screenshot.png');
  await worksheet.locator('#q').screenshot({ path: pngPath });
  await worksheet.close();
  console.log('  screenshot bytes:', fs.statSync(pngPath).size);

  await page.goto(baseUrl + '/');
  await page.locator('input[type=file]').setInputFiles(pngPath);
  await page.locator('img[alt="Question screenshot"]').waitFor();
  await shot(page, '4-image-preview.png');
  const image = await submitAndWait(page);
  await shot(page, '5-lesson-image.png');
  console.log('  url:', image.url);
  console.log('  badges:', await readBadges(page));
  console.log(
    '  submitted screenshot shown on lesson page:',
    await page.locator('img[alt="Submitted question screenshot"]').count(),
  );

  // 4. Clipboard paste path (synthetic paste event carrying the PNG)
  console.log('4. paste-image handler');
  await page.goto(baseUrl + '/');
  const b64 = fs.readFileSync(pngPath).toString('base64');
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], 'clipboard.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, b64);
  await page.locator('img[alt="Question screenshot"]').waitFor({ timeout: 10_000 });
  console.log('  pasted image preview appeared:', await page.getByText('pasted screenshot').count() > 0);
  await shot(page, '6-paste-preview.png');

  // 5. Grade 10 text question for the reading-level comparison
  console.log('5. text submission (grade 10)');
  await page.getByRole('button', { name: 'Remove image' }).click();
  await page.locator('textarea').fill(GRADE10);
  const g10 = await submitAndWait(page);
  await shot(page, '7-lesson-grade10.png');
  console.log('  url:', g10.url);
  console.log('  badges:', await readBadges(page));

  await browser.close();
  console.log(`\nscreenshots in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
