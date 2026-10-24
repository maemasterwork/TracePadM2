import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { axeClean } from './helpers';
import type { Labs } from '../src/learn/types';

const L3 = '/lesson/03-methods-and-functions';
const labs3 = JSON.parse(readFileSync('public/content/03-methods-and-functions/labs.json', 'utf8')) as Labs;

// Lesson 3's chapters are numbered 301..307 inside the app (shown as 1..7).
test('lesson 3 opens with its own chapter numbers and records a prediction', async ({ page }) => {
  await page.goto(`${L3}/1-methods`);
  await expect(page.getByRole('heading', { level: 1, name: /Methods/ })).toBeVisible();
  await expect(page.getByText('Chapter 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^7\. Appendix/ }).first()).toBeVisible();

  const p = labs3.chapters['301'].predictions![0];
  const card = page.locator(`[data-item="pred:301:${p.id}"]`);
  await card.getByLabel('What will this print?').fill(p.answer);
  await card.getByRole('button', { name: 'Run and compare' }).click();
  await expect(card.getByText('You predicted it.')).toBeVisible({ timeout: 60_000 });
});

test('a lesson 3 exercise passes with its solution, and an example gets a flowchart', async ({ page }) => {
  await page.goto(`${L3}/2-functions`);
  const e = labs3.chapters['302'].exercises![0];
  const card = page.locator(`[data-item="ex:302:${e.id}"]`);
  await card.getByLabel('Your code for this exercise').fill(e.solution);
  await card.getByRole('button', { name: 'Check my code' }).click();
  await expect(card.getByText(/All \d+ tests pass/)).toBeVisible({ timeout: 60_000 });

  await page.goto(`${L3}/1-methods`);
  const block = page.locator('[data-block="1.6#2"]');
  await block.scrollIntoViewIfNeeded();
  await block.getByRole('button', { name: 'Flowchart' }).click();
  await expect(block.locator('svg.flow')).toBeVisible();
  await expect(block.locator('svg.flow .flow-node.k-loop')).toHaveCount(1);
});

test('lesson 3 pages pass accessibility checks', async ({ page }) => {
  await page.goto(`${L3}/4-nested-statements-and-scope`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await axeClean(page, 'lesson 3 chapter 4');
});
