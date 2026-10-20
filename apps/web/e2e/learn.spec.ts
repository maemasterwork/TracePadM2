import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { LESSON, axeClean, setPrefs } from './helpers';
import type { Labs } from '../src/learn/types';

const labs = JSON.parse(readFileSync('public/content/01-objects-and-data-structures/labs.json', 'utf8')) as Labs;
const CH1 = `${LESSON}/1-numbers`;
const p1 = labs.chapters['1'].predictions![0];

async function idbGet(page: Page, key: string) {
  return page.evaluate((k) => new Promise((res) => {
    const o = indexedDB.open('tracepad');
    o.onsuccess = () => { const g = o.result.transaction('progress').objectStore('progress').get(k); g.onsuccess = () => res(g.result ?? null); };
  }), key) as Promise<{ data: Record<string, unknown> } | null>;
}
async function idbPut(page: Page, key: string, value: unknown) {
  await page.evaluate(([k, v]) => new Promise<void>((res) => {
    const o = indexedDB.open('tracepad');
    o.onsuccess = () => { const tx = o.result.transaction('progress', 'readwrite'); tx.objectStore('progress').put(v, k as string); tx.oncomplete = () => res(); };
  }), [key, value]);
}
async function answerWrong(page: Page) {
  await page.goto(CH1);
  const card = page.locator(`[data-item="pred:1:${p1.id}"]`);
  await card.getByLabel('What will this print?').fill('wrong answer');
  await card.getByRole('button', { name: 'Run and compare' }).click();
  await expect(card.getByText('Not quite. Look at the difference.')).toBeVisible();
  await expect.poll(() => idbGet(page, `guest|row|rev:pred:1:${p1.id}`)).not.toBeNull();
}

test.describe('review, progress and mastery', () => {
  test('a wrong answer joins the watch-list, comes back when due, and moves up when answered right', async ({ page }) => {
    await answerWrong(page);
    const rev = await idbGet(page, `guest|row|rev:pred:1:${p1.id}`);
    expect(rev!.data.box).toBe(0);
    expect(rev!.data.due as number).toBeGreaterThan(Date.now() + 20 * 3600_000); // tomorrow
    await page.goto('/review');
    await expect(page.getByText('Nothing is due right now.', { exact: false })).toBeVisible();
    // make it due
    const row = (await idbGet(page, `guest|row|rev:pred:1:${p1.id}`)) as unknown as { data: Record<string, unknown>; key: string; client_ts: number };
    await idbPut(page, `guest|row|rev:pred:1:${p1.id}`, { ...row, data: { ...row.data, due: Date.now() - 1000 }, client_ts: Date.now() });
    await page.reload();
    await expect(page.getByRole('link', { name: /Review/ })).toContainText('1');
    await page.getByRole('button', { name: 'Start review' }).click();
    await expect(page.getByText('Item 1 of 1')).toBeVisible();
    await page.getByLabel('What will this print?').fill(p1.answer);
    await page.getByRole('button', { name: 'Run and compare' }).click();
    await expect(page.getByText('You predicted it.')).toBeVisible();
    await expect(page.getByText(/Moves up/)).toBeVisible();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByText("That is today's review. 1 of 1 right.")).toBeVisible();
    await expect.poll(async () => (await idbGet(page, `guest|row|rev:pred:1:${p1.id}`))!.data.box).toBe(1);
  });

  test('progress shows the concept that needs review, a streak, and chapter counts', async ({ page }) => {
    await answerWrong(page);
    await page.goto('/progress');
    await expect(page.getByText('1 days in a row', { exact: false }).or(page.getByText(/1 days? in a row/))).toBeVisible();
    const concept = page.locator('.concepts li').first();
    await expect(concept).toContainText('needs review');
    await expect(concept.locator('.meter')).toHaveAttribute('aria-label', /%/);
    await expect(page.locator('.chapter-progress li').first()).toContainText('Numbers');
  });

  for (const [theme, locale] of [['light', 'en'], ['dark', 'fa']] as const) {
    test(`review and progress pages are accessible (${theme}, ${locale})`, async ({ page }) => {
      await setPrefs(page, { theme, locale });
      await page.goto('/');
      const now = Date.now();
      await idbPut(page, `guest|row|pred:1:${p1.id}`, { key: `pred:1:${p1.id}`, client_ts: now, data: { right: false, guess: 'x', tries: 1, hist: [{ t: now, ok: false }] } });
      await idbPut(page, `guest|row|rev:pred:1:${p1.id}`, { key: `rev:pred:1:${p1.id}`, client_ts: now, data: { box: 0, due: now - 1000, last: now, lapses: 1 } });
      await page.goto('/progress');
      await expect(page.locator('h1')).toBeVisible();
      await axeClean(page, `progress ${theme} ${locale}`);
      await page.goto('/review');
      await expect(page.locator('h1')).toBeVisible();
      await axeClean(page, `review ${theme} ${locale}`);
      await page.locator('main .btn').first().click();
      await expect(page.locator('.lab')).toBeVisible();
      await axeClean(page, `review card ${theme} ${locale}`);
    });
  }
});

test.describe('notes, bookmarks, search, shortcuts', () => {
  test('a note and a bookmark on a paragraph survive a reload and appear on My notes', async ({ page }) => {
    await page.goto(CH1);
    const para = page.locator('.prose .blk').nth(2);
    await para.hover();
    await para.getByRole('button', { name: 'Add a note' }).click();
    await para.getByLabel('Your note on this paragraph').fill('Remember: floor division rounds down');
    await para.getByRole('button', { name: 'Save note' }).click();
    await expect(para.locator('.note-box')).toContainText('floor division');
    await para.getByRole('button', { name: 'Bookmark this paragraph' }).click();
    await expect(para.getByRole('button', { name: 'Remove bookmark' })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('.prose .blk').nth(2).locator('.note-box')).toContainText('floor division');
    await page.getByRole('link', { name: 'My notes and bookmarks' }).click();
    await expect(page.locator('.notes-list li')).toHaveCount(2);
    await page.locator('.notes-list li').first().getByRole('link', { name: /Go to paragraph/ }).click();
    await expect(page).toHaveURL(/1-numbers#b\d+/);
    await expect(page.locator('.prose .blk').nth(2)).toBeInViewport();
  });

  test('deleting a note removes it', async ({ page }) => {
    await page.goto(CH1);
    const para = page.locator('.prose .blk').nth(1);
    await para.getByRole('button', { name: 'Add a note' }).click();
    await para.getByLabel('Your note on this paragraph').fill('temp');
    await para.getByRole('button', { name: 'Save note' }).click();
    await para.getByRole('button', { name: 'Edit note' }).click();
    await para.getByRole('button', { name: 'Delete note' }).click();
    await expect(para.locator('.note-box')).toHaveCount(0);
  });

  test('search finds text and code across the lesson and jumps to the paragraph', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('searchbox').fill('dictionar');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.results li').first()).toBeVisible();
    await expect(page.locator('.results mark').first()).toBeVisible();
    await page.locator('.results li a').first().click();
    await expect(page).toHaveURL(/\/lesson\/.*#b\d+/);
    await page.goto('/search?q=zzzqqq');
    await expect(page.getByText('Nothing found for zzzqqq.')).toBeVisible();
  });

  test('search works offline once the lesson was loaded', async ({ page, context }) => {
    await page.goto('/search');
    await page.getByRole('searchbox').fill('tuple');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.results li').first()).toBeVisible();
    await page.waitForTimeout(1500); // let the service worker take control
    await page.reload();
    await context.setOffline(true);
    await page.goto('/search?q=tuple');
    await expect(page.locator('.results li').first()).toBeVisible({ timeout: 20_000 });
    await context.setOffline(false);
  });

  test('keyboard: / opens search, ? lists shortcuts, Esc closes, ] goes to the next chapter', async ({ page }) => {
    await page.goto(CH1);
    await expect(page.locator('#chapter-title')).toBeVisible();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/2-variable-assignment/);
    await page.keyboard.press('[');
    await expect(page).toHaveURL(/1-numbers/);
    await page.keyboard.press('/');
    await expect(page).toHaveURL(/\/search/);
  });

  for (const [theme, locale] of [['light', 'en'], ['dark', 'fa']] as const) {
    test(`notes, search and the shortcuts dialog are accessible (${theme}, ${locale})`, async ({ page }) => {
      await setPrefs(page, { theme, locale });
      await page.goto(CH1);
      const para = page.locator('.prose .blk').nth(2);
      await para.locator('.icon-btn').first().click({ force: true });
      await expect(para.locator('textarea')).toBeVisible();
      await axeClean(page, `note editor ${theme} ${locale}`);
      await page.goto('/search?q=list');
      await expect(page.locator('.results li').first()).toBeVisible();
      await axeClean(page, `search ${theme} ${locale}`);
      await page.goto('/notes');
      await axeClean(page, `notes ${theme} ${locale}`);
      await page.keyboard.press('?');
      await expect(page.getByRole('dialog')).toBeVisible();
      await axeClean(page, `shortcuts ${theme} ${locale}`);
    });
  }

  test('the memory model is accessible and sensible on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`${LESSON}/2-variable-assignment`);
    await page.locator('.labs').getByRole('button', { name: 'Trace it' }).click();
    const mem = page.locator('.labs .mem');
    await expect(mem.getByText(/Step 1 of/).first()).toBeVisible({ timeout: 20_000 });
    await mem.getByRole('button', { name: 'Last step' }).click();
    await axeClean(page, 'memory model phone');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});
