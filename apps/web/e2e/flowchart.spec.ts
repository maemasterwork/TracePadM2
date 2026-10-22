import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { LESSON, axeClean, setPrefs } from './helpers';
import type { FlowMap } from '../src/flow/types';

const flows = JSON.parse(readFileSync('public/content/01-objects-and-data-structures/flow.json', 'utf8')) as FlowMap;
const CH8 = `${LESSON}/8-sets-and-booleans`;
const BLOCK = '8.5#1'; // a loop with a yes/no question inside it
const chart = flows[`block:${BLOCK}`].charts[0];

test('a flowchart is drawn for an example, with a text version', async ({ page }) => {
  await page.goto(CH8);
  const block = page.locator(`[data-block="${BLOCK}"]`);
  await block.scrollIntoViewIfNeeded();
  await block.getByRole('button', { name: 'Flowchart' }).click();
  const svg = block.locator('svg.flow');
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute('role', 'img');
  await expect(svg.locator('.flow-node')).toHaveCount(chart.nodes.length);
  await expect(svg.locator('.flow-node.k-decision')).toHaveCount(1);
  await expect(svg.locator('.flow-node.k-loop')).toHaveCount(1);
  await block.getByText('Text version of this flowchart').click();
  await expect(block.locator('.flow-outline')).toContainText('Decision: not items ?');
  await expect(block.getByRole('button', { name: 'Hide flowchart' })).toHaveAttribute('aria-pressed', 'true');
});

test('stepping through the trace highlights the running box and counts loop rounds', async ({ page }) => {
  await page.goto(CH8);
  const block = page.locator(`[data-block="${BLOCK}"]`);
  await block.scrollIntoViewIfNeeded();
  await block.getByRole('button', { name: 'Flowchart' }).click();
  await block.getByRole('button', { name: 'Trace it' }).click();
  await expect(block.getByRole('button', { name: 'Next step' })).toBeVisible({ timeout: 60_000 });
  const on = block.locator('.flow-node.on');
  await expect(on).toHaveCount(1);
  const first = await on.getAttribute('data-node');
  expect(first).toBe(chart.nodes.find((n) => n.lines && n.lines[0] === 1)!.id); // step 1 is the loop line
  // walk the trace until the yes/no question (line 5, after the loop) is the running box
  const decision = chart.nodes.find((n) => n.kind === 'decision')!.id;
  const seen = new Set<string>([first!]);
  for (let i = 0; i < 40 && !seen.has(decision); i++) {
    await block.getByRole('button', { name: 'Next step' }).click();
    seen.add((await block.locator('.flow-node.on').getAttribute('data-node'))!);
  }
  expect(seen.has(decision)).toBe(true); // it moved along the chart, past the loop, to the question
  await expect(block.locator('.flow-node.seen').first()).toBeAttached();
  // the loop head has run more than once by now
  await expect(block.locator('.flow-count').first()).toContainText('×');
  await expect(block.getByRole('status').filter({ hasText: 'Now at:' })).toHaveCount(1);
  if (process.env.SHOTS) await block.screenshot({ path: '/tmp/shots/flow-trace.png' });
});

test('after editing the code the chart is redrawn for the new code; unreadable code says so', async ({ page }) => {
  await page.goto(CH8);
  const block = page.locator(`[data-block="${BLOCK}"]`);
  await block.scrollIntoViewIfNeeded();
  await block.getByRole('button', { name: 'Flowchart' }).click();
  await expect(block.locator('svg.flow')).toBeVisible();
  const editor = block.locator('textarea, [contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\nfor k in range(2):\n    print(k)\n');
  // the Python engine draws it (first time: it has to start): a second loop box appears
  await expect(block.locator('svg.flow .flow-node.k-loop')).toHaveCount(2, { timeout: 90_000 });
  await page.keyboard.type('print(');                      // not a program any more
  await expect(block.getByText('No chart yet')).toBeVisible({ timeout: 30_000 });
  await block.getByRole('button', { name: 'Reset' }).click();
  await expect(block.locator('svg.flow .flow-node.k-loop')).toHaveCount(1);
});

test('exercise editors can show a flowchart of what the learner has typed', async ({ page }) => {
  await page.goto(`${LESSON}/1-numbers`);
  const card = page.locator('[data-item="ex:1:e1"]');
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'Flowchart' }).click();
  await expect(card.locator('svg.flow, p.note').first()).toBeVisible({ timeout: 90_000 });
  const editor = card.locator('textarea, [contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('total = 0\nfor n in range(3):\n    total += n\nprint(total)\n');
  await expect(card.locator('svg.flow .flow-node.k-loop')).toHaveCount(1, { timeout: 30_000 });
});

test('a prediction offers its flowchart only after it was answered', async ({ page }) => {
  await page.goto(`${LESSON}/1-numbers`);
  const card = page.locator('[data-item="pred:1:p1"]');
  await expect(card.getByRole('button', { name: 'Flowchart' })).toHaveCount(0);
  await card.getByLabel('What will this print?').fill('x');
  await card.getByRole('button', { name: /Run/ }).click();
  await expect(card.getByRole('button', { name: 'Flowchart' })).toBeVisible({ timeout: 60_000 });
  await card.getByRole('button', { name: 'Flowchart' }).click();
  await expect(card.locator('svg.flow')).toBeVisible();
});

for (const [theme, locale] of [['light', 'en'], ['dark', 'en'], ['light', 'fa'], ['dark', 'fa']] as const) {
  test(`flowchart screens: accessible, right-to-left aware, no sideways page scroll (${theme}, ${locale})`, async ({ page }) => {
    await setPrefs(page, { theme, locale });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(CH8);
    const block = page.locator(`[data-block="${BLOCK}"]`);
    await block.scrollIntoViewIfNeeded();
    await block.locator('button[aria-pressed]').filter({ hasText: /Flowchart|فلوچارت/ }).first().click();
    await expect(block.locator('svg.flow')).toBeVisible();
    // mirrored for Persian: the loop's body is drawn to the right of the "start" column instead of the left, so positions flip
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe(locale === 'fa' ? 'rtl' : 'ltr');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
    await axeClean(page, `flowchart ${theme} ${locale}`);
    if (process.env.SHOTS) await block.screenshot({ path: `/tmp/shots/flow-${locale}-${theme}.png` });
  });
}
