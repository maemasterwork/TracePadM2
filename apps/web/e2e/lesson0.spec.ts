import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { axeClean, setPrefs } from './helpers';
import type { Labs } from '../src/learn/types';
import type { FlowMap } from '../src/flow/types';

const L0 = '/lesson/00-flowcharts-made-easy';
const CH5 = `${L0}/5-block-2-decision-if-else`;
const labs0 = JSON.parse(readFileSync('public/content/00-flowcharts-made-easy/labs.json', 'utf8')) as Labs;
const flows0 = JSON.parse(readFileSync('public/content/00-flowcharts-made-easy/flow.json', 'utf8')) as FlowMap;

// Lesson 0 is the flowchart primer. Its diagrams are Mermaid in the lesson text; the build lays them out and the app draws them.
test('lesson 0 comes first on the course page', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('main h2');
  await expect(cards.first()).toContainText('Flowcharts Made Easy');
});

test('the lesson\'s own diagrams are drawn, with a text version and the Mermaid source', async ({ page }) => {
  await page.goto(CH5);
  const figs = page.locator('.mermaid-fig');
  await expect(figs).toHaveCount(2);                       // even / odd, and the grade chain
  const first = figs.first();
  const chart = flows0['block:5.0#1'].charts[0];
  await expect(first.locator('svg.flow .flow-node')).toHaveCount(chart.nodes.length);
  await expect(first.locator('svg.flow .flow-node.k-decision')).toHaveCount(1);
  await expect(first.locator('svg.flow .flow-node.k-io')).toHaveCount(3);                  // read, print even, print odd
  await expect(first.locator('.flow-elabel')).toHaveText(['Yes', 'No']);
  await first.getByText('Text version of this flowchart').click();
  await expect(first.locator('.flow-outline').first()).toContainText('Question: n % 2 == 0?');
  await first.getByText('Diagram source (Mermaid text)').click();
  await expect(first.locator('pre')).toContainText('flowchart TD');
  // the Python example next to it still has its own generated flowchart
  await expect(page.locator('[data-block="5.0#2"]').getByRole('button', { name: 'Flowchart' })).toBeVisible();
});

test('lesson 0 practice works and its progress is its own', async ({ page }) => {
  await page.goto(CH5);
  const p = labs0.chapters['10005'].predictions![0];
  const card = page.locator(`[data-item="pred:10005:${p.id}"]`);
  await card.getByLabel('What will this print?').fill(p.answer);
  await card.getByRole('button', { name: 'Run and compare' }).click();
  await expect(card.getByText('You predicted it.')).toBeVisible({ timeout: 60_000 });
  await page.goto('/progress');
  const li = page.locator('.chapter-progress li', { hasText: 'Block 2' });
  await expect(li).toContainText('5. Block 2: Decision');
  await expect(li).toContainText('1 of 5 done');
});

test('an English label keeps its question mark at the end in the right-to-left layout', async ({ page }) => {
  await setPrefs(page, { locale: 'fa' });
  await page.goto(CH5);
  const q = page.locator('.mermaid-fig').first().locator('.flow-node.k-decision .flow-text');
  await expect(q).toHaveAttribute('direction', 'ltr');
  await expect(q).toHaveText('n % 2 == 0?');
});

for (const prefs of [{ theme: 'light' }, { theme: 'dark', locale: 'fa' }]) {
  test(`lesson 0 diagrams pass accessibility checks (${JSON.stringify(prefs)}), and the page does not scroll sideways at 360 px`, async ({ page }) => {
    await setPrefs(page, prefs);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${L0}/9-full-example-guess-the-number-game`);
    await expect(page.locator('.mermaid-fig svg.flow')).toBeVisible();
    await axeClean(page, `lesson 0 chapter 9 ${JSON.stringify(prefs)}`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
}
