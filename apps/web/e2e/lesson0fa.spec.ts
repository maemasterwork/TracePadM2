import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { axeClean, setPrefs } from './helpers';
import type { Labs } from '../src/learn/types';

const L0 = '/lesson/00-flowcharts-made-easy';
const CH5 = `${L0}/5-block-2-decision-if-else`;
const labs0 = JSON.parse(readFileSync('public/content/00-flowcharts-made-easy/labs.json', 'utf8')) as Labs;
const fa = JSON.parse(readFileSync('src/i18n/locales/fa.json', 'utf8')) as Record<string, string>;

// Lesson 0 has a Persian version of its text (lesson.fa.md). It keeps the English structure, so chapter ids, notes and progress are the same.
test('in Persian the lesson text is Persian, right to left, with no "not translated" notice, and code stays left to right', async ({ page }) => {
  await setPrefs(page, { locale: 'fa' });
  await page.goto(CH5);
  const article = page.locator('article.prose');
  await expect(article).toHaveAttribute('lang', 'fa');
  await expect(article).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('۵. بلوک ۲: تصمیم');
  await expect(page.getByText(fa['lesson.notTranslated'])).toHaveCount(0);
  const code = article.locator('.codeblock pre, .codeblock .editor').first();
  await expect(code).toHaveCSS('direction', 'ltr');
  // the translated diagram is drawn with Persian labels
  const fig = page.locator('.mermaid-fig').first();
  await expect(fig.locator('.flow-text', { hasText: 'شروع' }).first()).toBeVisible();
  await expect(fig.locator('.flow-node.k-decision')).toHaveCount(1);
  // the chart's own controls are Persian too
  await expect(page.getByText(fa['flow.textVersion']).first()).toBeVisible();
  await expect(page.getByText(fa['flow.howToRead']).first()).toBeVisible();
  await expect(page.getByText('Text version of this flowchart')).toHaveCount(0);
});

test('English is unchanged: the same chapter in English has English text and no Persian', async ({ page }) => {
  await page.goto(CH5);
  await expect(page.locator('article.prose')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Decision');
});

test('Persian practice cards work and progress keeps the same chapter number as in English', async ({ page }) => {
  await setPrefs(page, { locale: 'fa' });
  await page.goto(CH5);
  const p = labs0.chapters['10005'].predictions![0];
  const card = page.locator(`[data-item="pred:10005:${p.id}"]`);
  await expect(card).toBeVisible();
  await card.getByLabel(fa['lab.guessLabel']).fill(p.answer);
  await card.getByRole('button', { name: fa['lab.runCompare'] }).click();
  await expect(card.getByText(fa['lab.matched'])).toBeVisible({ timeout: 60_000 });
  // the same answer is recorded for the English page
  // progress is keyed by the same chapter number, so the English progress page counts it too
  await setPrefs(page, { locale: 'en' });
  await page.goto('/progress');
  await expect(page.locator('.chapter-progress li', { hasText: 'Block 2' })).toContainText('1 of 5 done');
});

test('the progress page shows the Persian chapter titles', async ({ page }) => {
  await setPrefs(page, { locale: 'fa' });
  await page.goto('/progress');
  await expect(page.locator('.chapter-progress li', { hasText: 'تصمیم' }).first()).toBeVisible();
});

test('search finds Persian lesson text', async ({ page }) => {
  await setPrefs(page, { locale: 'fa' });
  await page.goto('/search?q=' + encodeURIComponent('لوزی'));
  await expect(page.locator('.results li').first()).toBeVisible({ timeout: 30_000 });
});

for (const prefs of [{ theme: 'light', locale: 'fa' }, { theme: 'dark', locale: 'fa' }]) {
  test(`Persian lesson 0 passes accessibility checks (${prefs.theme}) and does not scroll sideways at 360 px`, async ({ page }) => {
    await setPrefs(page, prefs);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${L0}/2-the-symbols-you-need`);
    await expect(page.locator('article.prose table')).toBeVisible();
    await axeClean(page, `Persian lesson 0 chapter 2 ${prefs.theme}`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
}
