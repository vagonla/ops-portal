import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';

function workbook(serial = 46000, name = 'TEST ÇALIŞAN') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Test program', 'Team', ...Array.from({ length: 7 }, (_, i) => serial + i)],
    [name, 'Team: 1 Test', ...Array(5).fill('08:00-16:00'), 'DO', 'DO'],
    ['DİĞER TEST', 'Team: 1 Test', ...Array(7).fill('16:00-00:00')],
  ]), 'Test');
  return { name: 'synthetic.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) };
}
async function setup(context, extras = {}) {
  await context.addInitScript(values => {
    if (!localStorage.getItem('qa-initialized')) {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      localStorage.setItem('qa-initialized', 'yes');
    }
  }, { 'vardiya-disclaimer-accepted': 'true', ...extras });
}
async function openTracker(page) {
  await page.getByRole('button', { name: 'Takip ettiğim çalışanlar', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Takip listem' })).toBeVisible();
}

test('keeps the existing local list and profile while removing old tracking and account metadata', async ({ context, page }) => {
  await setup(context, {
    'ops-tracked-friends-v1': JSON.stringify(['TEST ÇALIŞAN']),
    'vardiya-my-name': 'TEST ÇALIŞAN', 'ops-analytics-visitor-v1': 'old',
    'ops-analytics-session-v1': 'old', 'vardiya-pending-invite': 'old',
  });
  const apiRequests = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
  await page.goto('/');
  await page.locator('#file-input').setInputFiles(workbook());
  await openTracker(page);
  await expect(page.locator('.social-local-member')).toHaveCount(1);
  await expect(page.locator('.social-local-member')).toContainText('TEST ÇALIŞAN');
  await expect(page.locator('.social-week-grid strong').first()).toHaveText('08:00-16:00');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-analytics-visitor-v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('vardiya-my-name'))).toBe('TEST ÇALIŞAN');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('vardiya-app-state')))).toBe(true);
  await page.reload();await openTracker(page);
  await expect(page.locator('.social-local-member')).toContainText('TEST ÇALIŞAN');
  expect(apiRequests).toEqual([]);
});

test('adds and removes tracked employees and matches them again when a weekly file is replaced', async ({ context, page }) => {
  await setup(context);await page.goto('/');await page.locator('#file-input').setInputFiles(workbook());await openTracker(page);
  await page.getByRole('textbox', { name: 'Çalışan ara ve ekle' }).fill('TEST ÇALIŞAN');
  await page.locator('.social-candidate-list button').click();
  await expect(page.locator('.social-local-member')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.locator('input[type=file][accept=".xlsx,.xls"]').first().setInputFiles(workbook(46007));
  await openTracker(page);await expect(page.locator('.social-local-member .social-week-grid')).toHaveCount(1);
  await page.getByRole('button', { name: 'TEST ÇALIŞAN adlı çalışanı takipten çıkar' }).click();
  await expect(page.locator('.social-local-member')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-tracked-friends-v1')))).toEqual([]);
});

test('keeps tracked names when a new file does not contain the employee', async ({ context, page }) => {
  await setup(context, { 'ops-tracked-friends-v1': JSON.stringify(['TEST ÇALIŞAN']) });
  await page.goto('/');await page.locator('#file-input').setInputFiles(workbook(46000, 'BAŞKA ÇALIŞAN'));await openTracker(page);
  await expect(page.locator('.social-local-member')).toContainText('Bu haftanın dosyasında bulunamadı');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-tracked-friends-v1')))).toEqual(['TEST ÇALIŞAN']);
});

test('the mobile app and tracked sheet fit narrow screens and use Anek Latin', async ({ context, page }) => {
  await setup(context);await page.setViewportSize({ width: 320, height: 800 });
  const errors=[];page.on('pageerror', error=>errors.push(error.message));
  await page.goto('/');await page.locator('#file-input').setInputFiles(workbook());
  await page.getByRole('button', { name: 'Takip', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Takip listem' })).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>getComputedStyle(document.body).fontFamily)).toContain('Anek Latin');
  await page.keyboard.press('Escape');expect(errors).toEqual([]);
  await expect(page.getByText('VagonlaPass', { exact: false })).toHaveCount(0);
});

test('removed server routes are inaccessible', async ({ request }) => {
  for (const path of ['/api/me','/api/auth/login','/api/social','/api/analytics/events']) expect((await request.get(path)).status()).toBe(410);
  expect((await request.get('/admin/analytics')).status()).toBe(404);
});
