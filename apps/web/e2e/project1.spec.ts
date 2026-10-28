import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { axeClean } from './helpers';
import type { Labs } from '../src/learn/types';

const P1 = '/lesson/10-milestone-project-1-tic-tac-toe';
const labs = JSON.parse(readFileSync('public/content/10-milestone-project-1-tic-tac-toe/labs.json', 'utf8')) as Labs;

// The project's chapters are numbered 1001..1010 inside the app (shown as 1..10); its card says "P1".
test('the course page shows the project card with its P1 label', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.card', { hasText: 'Milestone Project 1: Tic Tac Toe' });
  await expect(card).toBeVisible();
  await expect(card.locator('.num')).toHaveText('P1');
  await expect(card.getByRole('link', { name: 'Open lesson' })).toBeVisible();
});

test('the project opens, draws its plan as a flowchart, and records a prediction', async ({ page }) => {
  await page.goto(`${P1}/2-plan-before-you-code`);
  await expect(page.getByRole('heading', { level: 1, name: /Plan Before You Code/ })).toBeVisible();
  await expect(page.getByText('Chapter 2', { exact: true })).toBeVisible();
  await expect(page.locator('svg.flow').first()).toBeVisible();

  const p = labs.chapters['1002'].predictions![0];
  const card = page.locator(`[data-item="pred:1002:${p.id}"]`);
  await card.getByLabel('What will this print?').fill(p.answer);
  await card.getByRole('button', { name: 'Run and compare' }).click();
  await expect(card.getByText('You predicted it.')).toBeVisible({ timeout: 60_000 });
});

test('a project exercise passes with its solution', async ({ page }) => {
  await page.goto(`${P1}/6-step-4-who-has-won`);
  const e = labs.chapters['1006'].exercises![0];
  const card = page.locator(`[data-item="ex:1006:${e.id}"]`);
  await card.getByLabel('Your code for this exercise').fill(e.solution);
  await card.getByRole('button', { name: 'Check my code' }).click();
  await expect(card.getByText(/All \d+ tests pass/)).toBeVisible({ timeout: 60_000 });
});

test('the finished game can be played to the end in the browser', async ({ page }) => {
  await page.goto(`${P1}/9-step-7-put-it-all-together`);
  const block = page.locator('[data-block="9.4#1"]');
  await block.scrollIntoViewIfNeeded();
  await block.getByRole('button', { name: 'Run' }).click();
  // X, one mistake on purpose (abc), then five moves that win for whoever starts, then "no more games"
  for (const answer of ['X', '1', '4', 'abc', '2', '5', '3', 'n']) {
    const live = block.getByLabel(/waiting for input/i);
    await live.waitFor({ timeout: 60_000 });
    await live.fill(answer);
    await live.press('Enter');
  }
  const out = block.locator('.outbox').last();
  await expect(out).toContainText('Please type a number from 1 to 9.', { timeout: 60_000 });
  await expect(out).toContainText('has won!');
  await expect(out).toContainText('Thanks for playing!');
});

test('project pages pass accessibility checks', async ({ page }) => {
  await page.goto(`${P1}/5-step-3-ask-for-a-position`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await axeClean(page, 'project chapter 5');
});
