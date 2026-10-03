import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Exercise the real worker, matching-input export, and session-only toggle from the event log.
test('damage capture reruns the baseline and exports its calculations without persisting the toggle', async ({
  page
}) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(
    () => window.professionApp.simulationStatus === 'idle' && window.professionApp.results?.totalDamage > 0
  );
  const original = await page.evaluate(() => {
    const app = window.professionApp;
    return {
      damage: app.results.totalDamage,
      seed: app.results.randomness.seed,
      rotation: app.build.rotation,
      revision: app.buildRevision
    };
  });
  await page.locator('#rotation-event-log > details > summary').click();
  const capture = page.getByRole('checkbox', { name: 'Capture damage calculations' });
  const download = page.locator('#rotation-event-log [data-role="event-log-download"]');
  await expect(capture).not.toBeChecked();
  await expect(page.locator('#rotation-event-log .btn-csv-export')).toHaveCount(1);
  await expect(download).toHaveText('Download CSV Log');
  const csvFile = page.waitForEvent('download');
  await download.click();
  const csv = await csvFile;
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  expect(await readFile(await csv.path(), 'utf8')).toContain('"Time (s)","Type","Event"');
  await capture.check();
  await expect(download).toHaveText('Download debug JSON');
  await expect(download).toBeEnabled();
  await expect(page.locator('#rotation-event-log .btn-csv-export')).toHaveCount(1);
  expect(await page.evaluate(() => window.professionApp.results.totalDamage)).toBe(original.damage);
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(original.revision);
  const hit = page
    .locator('#rotation-event-log .log-desc summary')
    .filter({ hasText: /^(CLONE )?HIT / })
    .first();
  await hit.click();
  await expect(page.locator('#rotation-event-log .log-desc[open]')).toContainText('Unrounded damage:');

  await download.click();
  const exportedFile = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Export', exact: true }).click();
  const json = await exportedFile;
  expect(json.suggestedFilename()).toMatch(/\.json$/);
  const exported = JSON.parse(await readFile(await json.path(), 'utf8'));
  expect(exported.rotation).toEqual(original.rotation);
  expect(exported.config.randomness.seed).toBe(original.seed);
  expect(exported.config.patchId).toBe('current');
  expect(exported.result.damageEvents.some((event) => event.damageCalculation)).toBe(true);

  await capture.uncheck();
  await page.waitForFunction(
    () => window.professionApp.simulationStatus === 'idle' && !window.professionApp.results.debugInputs
  );
  await expect(download).toHaveText('Download CSV Log');
  await expect(download).toBeEnabled();
  const restoredCsvFile = page.waitForEvent('download');
  await download.click();
  expect((await restoredCsvFile).suggestedFilename()).toMatch(/\.csv$/);
  // Trait application disclosures remain available when optional damage calculations are switched off.
  await expect(page.locator('#rotation-event-log .log-desc summary').filter({ hasText: /^(CLONE )?HIT / })).toHaveCount(
    0
  );
  await capture.check();
  await expect(download).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.damageDiagnostics)).toBe(false);
  expect(await page.evaluate(() => window.professionApp.results.debugInputs)).toBeUndefined();
});

// Native disclosure must open from the keyboard and render diagnostic text safely.
test('damage calculation details open with the keyboard', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { mountEventLog } = await import('/js/ui/results/event-log.ts');
    document.body.innerHTML = '<div id="log"></div>';
    mountEventLog(
      document.getElementById('log'),
      [
        {
          at: 0.600001,
          type: 'damage',
          description: 'HIT Example',
          details: ['Simulation time: 0.600001s; phase: Ordinary', 'Power: <1000>']
        }
      ],
      { initiallyOpen: true }
    );
  });
  const calculation = page.locator('.log-desc');
  await expect(calculation.locator('li').first()).toBeHidden();
  await calculation.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(calculation.locator('li').first()).toBeVisible();
  await expect(calculation.locator('li').last()).toHaveText('Power: <1000>');
});

// Real layout verifies that rebuilding log rows retains scrolling and navigation works at both edges.
test('event log preserves reading position and follows the end across updates', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountEventLog } = await import('/js/ui/results/event-log.ts');
    document.body.innerHTML = '<div id="log" class="rotation-event-log"></div>';
    window.renderLog = (count) =>
      mountEventLog(
        document.getElementById('log'),
        Array.from({ length: count }, (_, at) => ({ at, type: 'cast', description: `CAST Skill ${at}` })),
        { initiallyOpen: true }
      );
    window.renderLog(100);
  });
  const log = page.locator('[data-role="event-log-rows"]');
  await log.evaluate((element) => {
    element.scrollTop = 200;
  });
  await page.evaluate(() => window.renderLog(120));
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(200);

  await page.getByRole('button', { name: 'Jump to end', exact: true }).click();
  await page.evaluate(() => window.renderLog(150));
  await expect
    .poll(() => log.evaluate((element) => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop)))
    .toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Jump to start', exact: true }).click();
  await page.evaluate(() => window.renderLog(160));
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(0);
  await log.evaluate((element) => {
    element.scrollTop = 200;
  });
  await page.getByRole('searchbox', { name: 'Filter events' }).fill('CAST');
  await page.waitForTimeout(250);
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(200);
  await page.evaluate(() => window.renderLog(2));
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByRole('searchbox', { name: 'Filter events' })).toHaveValue('CAST');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// Real event handling verifies collapsing, ancestry tracing, and revealing a chronological row inside the tree.
test('event log tree collapses groups, traces causes, and reveals rows from the chronological layout', async ({
  page
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountEventLog } = await import('/js/ui/results/event-log.ts');
    document.body.innerHTML = '<div id="log" class="rotation-event-log"></div>';
    const partOf = { kind: 'recorded', label: 'part of' };
    mountEventLog(
      document.getElementById('log'),
      [
        { at: 0, type: 'cast', description: 'CAST Strike (500ms)', id: 'c1', ordinal: 1, span: 0.5 },
        {
          at: 0.5,
          type: 'damage',
          description: 'HIT Strike',
          id: 'h1',
          parentId: 'c1',
          parentLink: partOf,
          metric: 10
        },
        {
          at: 0.5,
          type: 'trigger',
          description: 'BUFF Might',
          id: 'b1',
          parentId: 'h1',
          parentLink: { kind: 'recorded', label: 'triggered by' }
        },
        { at: 0.5, type: 'cast_end', description: 'END Strike', parentId: 'c1', layout: 'flat' },
        { at: 0.9, type: 'damage', description: 'HIT Echo', id: 'h2', parentId: 'c1', parentLink: partOf, metric: 20 }
      ],
      { initiallyOpen: true }
    );
  });
  const rows = page.locator('[data-role="event-log-rows"] .log-line');
  await expect(rows).toHaveCount(4);

  await page.getByRole('button', { name: 'Collapse CAST Strike (500ms)' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('+3 rows');
  await page.getByRole('button', { name: 'Expand CAST Strike (500ms)' }).click();
  await expect(rows).toHaveCount(4);

  await rows.filter({ hasText: 'BUFF Might' }).hover();
  await expect(page.locator('[data-role="event-log-trace"]')).toHaveText(
    'BUFF Might ← triggered by ← HIT Strike ← part of ← CAST Strike (500ms) · #1'
  );

  await page.getByRole('button', { name: 'Chronological', exact: true }).click();
  await expect(rows).toHaveCount(5);
  await expect(rows.filter({ hasText: 'END Strike' })).toHaveCount(1);
  await rows.filter({ hasText: 'HIT Echo' }).getByRole('button', { name: '#1' }).click();
  await expect(page.getByRole('button', { name: 'Tree', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(rows.filter({ hasText: 'HIT Echo' })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
