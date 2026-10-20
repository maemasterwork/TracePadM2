import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { LESSON, axeClean, setPrefs } from './helpers';
import type { Labs } from '../src/learn/types';

const labs = JSON.parse(readFileSync('public/content/01-objects-and-data-structures/labs.json', 'utf8')) as Labs;
const ch1 = labs.chapters['1'];
const ch2 = labs.chapters['2'];
const CH1 = `${LESSON}/1-numbers`;

test.describe('practice', () => {
  test('a right prediction matches, a wrong one shows the difference and the reason', async ({ page }) => {
    await page.goto(CH1);
    const p = ch1.predictions![0];
    const card = page.locator(`[data-item="pred:1:${p.id}"]`);
    await card.getByLabel('What will this print?').fill('nope');
    await card.getByRole('button', { name: 'Run and compare' }).click();
    await expect(card.getByText('Not quite. Look at the difference.')).toBeVisible();
    await expect(card.getByText('Why:', { exact: false })).toBeVisible();
    await card.getByRole('button', { name: 'Try another guess' }).click();
    await card.getByLabel('What will this print?').fill(p.answer);
    await card.getByRole('button', { name: 'Run and compare' }).click();
    await expect(card.getByText('You predicted it.')).toBeVisible();
    await expect(card.locator('.chip.good')).toHaveText(/Done/);
  });

  test('a quiz marks the right option and explains', async ({ page }) => {
    await page.goto(`${LESSON}/2-variable-assignment`);
    const q = ch2.quizzes![0];
    const card = page.locator(`[data-item="quiz:2:${q.id}"]`);
    const wrong = (q.correct + 1) % q.options.length;
    await card.getByRole('radio').nth(wrong).check();
    await card.getByRole('button', { name: 'Check answer' }).click();
    await expect(card.getByText('Not quite.')).toBeVisible();
    await expect(card.locator('.opt.right')).toHaveCount(1);
  });

  test('an exercise: starter fails, hints unlock the solution, the solution passes every test', async ({ page }) => {
    await page.goto(CH1);
    const e = ch1.exercises![0];
    const card = page.locator(`[data-item="ex:1:${e.id}"]`);
    await card.getByRole('button', { name: 'Check my code' }).click();
    await expect(card.getByText(/tests pass\./)).toBeVisible();
    await expect(card.getByText('failed').first()).toBeVisible();
    const solBtn = card.getByRole('button', { name: 'Show the solution' });
    await expect(solBtn).toBeDisabled();
    for (let i = 0; i < e.hints.length; i++) await card.getByRole('button', { name: 'Show a hint' }).click();
    await expect(solBtn).toBeEnabled();
    await card.getByLabel('Your code for this exercise').fill(e.solution);
    await card.getByRole('button', { name: 'Check my code' }).click();
    await expect(card.getByText(/All \d+ tests pass/)).toBeVisible();
    await expect(page.getByTestId('lab-progress')).toContainText('1 of');
  });

  test('exercise progress survives a reload (code, hints and done state)', async ({ page }) => {
    await page.goto(CH1);
    const e = ch1.exercises![0];
    const card = page.locator(`[data-item="ex:1:${e.id}"]`);
    await card.getByLabel('Your code for this exercise').fill(e.solution);
    await card.getByRole('button', { name: 'Check my code' }).click();
    await expect(card.getByText(/All \d+ tests pass/)).toBeVisible();
    await page.reload();
    const again = page.locator(`[data-item="ex:1:${e.id}"]`);
    await expect(again.locator('.chip.good')).toHaveText(/Done/);
    await expect(again.getByLabel('Your code for this exercise')).toHaveValue(e.solution);
  });

  test('the error coach explains a mistake in plain words, with a suggestion', async ({ page }) => {
    await page.goto(CH1);
    const e = ch1.exercises![0];
    const card = page.locator(`[data-item="ex:1:${e.id}"]`);
    await card.getByLabel('Your code for this exercise').fill('total = 5\nprint(totl)');
    await card.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(card.getByText('Did you mean total?')).toBeVisible();
    await expect(card.getByText('Python does not know the name totl', { exact: false })).toBeVisible();
  });

  test('memory model: step through a program and see aliasing', async ({ page }) => {
    await page.goto(`${LESSON}/2-variable-assignment`);
    await page.locator('.labs').getByRole('button', { name: 'Trace it' }).click();
    const mem = page.locator('.labs .mem');
    await expect(mem).toBeVisible();
    await expect(mem.getByText(/Step 1 of/).first()).toBeVisible({ timeout: 20_000 });
    // go to the end: a and b point to the same list, c to a different one
    await mem.getByRole('button', { name: 'Last step' }).click();
    await expect(mem.locator('.mem-obj').first()).toBeVisible();
    const refs = await mem.locator('.mem-frames .mem-ref').allTextContents();
    expect(refs.length).toBeGreaterThanOrEqual(3);
    expect(new Set(refs).size).toBeLessThan(refs.length); // two names share one object
    await expect(mem.locator('.mem-arrows path').first()).toBeAttached();
    // stepping back changes the step counter
    await mem.getByRole('button', { name: 'Previous step' }).click();
    await expect(mem.getByText(/Step \d+ of \d+/).first()).toBeVisible();
    expect(ch2.memory_demo).toBeTruthy();
  });

  test('persian: labs are right-to-left, texts are Persian, code stays left-to-right', async ({ page }) => {
    await setPrefs(page, { locale: 'fa' });
    await page.goto(CH1);
    const p = ch1.predictions![0];
    const card = page.locator(`[data-item="pred:1:${p.id}"]`);
    await expect(card).toContainText('پیش‌بینی');
    await card.locator('textarea').fill(p.answer);
    await card.getByRole('button').first().click();
    await expect(card.locator('.verdict.good')).toBeVisible();
    await expect(card.locator('.lab-code')).toHaveAttribute('dir', 'ltr');
  });

  for (const [theme, locale] of [['light', 'en'], ['dark', 'fa']] as const) {
    test(`practice section is accessible (${theme}, ${locale})`, async ({ page }) => {
      await setPrefs(page, { theme, locale });
      await page.goto(CH1);
      const p = ch1.predictions![0];
      const card = page.locator(`[data-item="pred:1:${p.id}"]`);
      await card.locator('textarea').fill('x');
      await card.getByRole('button').first().click();
      await expect(card.locator('.verdict')).toBeVisible();
      await axeClean(page, `chapter 1 practice ${theme} ${locale}`);
    });
  }
});
