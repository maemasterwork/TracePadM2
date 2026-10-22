import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { LESSON, axeClean } from './helpers';
import type { Labs } from '../src/learn/types';

const L2 = '/lesson/02-python-statements';
const labs2 = JSON.parse(readFileSync('public/content/02-python-statements/labs.json', 'utf8')) as Labs;

// Progress keys carry only a chapter number, so lesson 2's chapters are numbered 201..209 inside the app (shown as 1..9).
test('lesson 2 opens, shows its own chapter numbers, and keeps its progress apart from lesson 1', async ({ page }) => {
  await page.goto(`${L2}/3-for-loops`);
  await expect(page.getByRole('heading', { level: 1, name: /for Loops/ })).toBeVisible();
  await expect(page.getByText('Chapter 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^9\. Appendix/ }).first()).toBeVisible();

  // answer a prediction of lesson 2 chapter 3
  const p = labs2.chapters['203'].predictions![0];
  const card = page.locator(`[data-item="pred:203:${p.id}"]`);
  await card.getByLabel('What will this print?').fill(p.answer);
  await card.getByRole('button', { name: 'Run and compare' }).click();
  await expect(card.getByText('You predicted it.')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await expect(page.getByRole('button', { name: /Read$/ })).toBeDisabled();

  // lesson 1 chapter 3 (strings) is untouched: same chapter number as printed, different lesson
  await page.goto(`${LESSON}/3-strings`);
  await expect(page.locator('[data-item^="pred:3:"] .chip.good')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark as read' })).toBeEnabled();

  // the progress page lists both lessons, with the printed chapter numbers
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: /Python Statements/ })).toBeVisible();
  const li = page.locator('.chapter-progress li', { hasText: 'For Loops' });
  await expect(li).toContainText('3. for Loops')
  await expect(li).toContainText('1 of 11 done');
  await expect(li).toContainText('Read');
});

test('a lesson 2 exercise passes with its solution, and an example gets a flowchart', async ({ page }) => {
  await page.goto(`${L2}/1-introduction-to-python-statements`);
  const e = labs2.chapters['201'].exercises![0];
  const card = page.locator(`[data-item="ex:201:${e.id}"]`);
  await card.getByLabel('Your code for this exercise').fill(e.solution);
  await card.getByRole('button', { name: 'Check my code' }).click();
  await expect(card.getByText(/All \d+ tests pass/)).toBeVisible({ timeout: 60_000 });

  await page.goto(`${L2}/3-for-loops`);
  const block = page.locator('[data-block="3.10#1"]'); // factorial
  await block.scrollIntoViewIfNeeded();
  await block.getByRole('button', { name: 'Flowchart' }).click();
  await expect(block.locator('svg.flow')).toBeVisible();
  await expect(block.locator('svg.flow .flow-node.k-loop')).toHaveCount(1);
});

test('lesson 2 pages pass accessibility checks', async ({ page }) => {
  await page.goto(`${L2}/2-if-elif-and-else-statements`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await axeClean(page, 'lesson 2 chapter 2');
});
