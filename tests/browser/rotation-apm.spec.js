import { expect, test } from '@playwright/test';

// The embedded summary follows worker results and keeps its details within the existing narrow layout.
test('APM updates with rotation edits and fits the 1130px workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1130, height: 900 });
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('#btn-sim-clear').click();
  const metric = page
    .locator('#rotation-dps-summary .res-stat')
    .filter({ has: page.locator('.res-label', { hasText: 'Actions / min' }) });
  await expect(metric.locator('.res-val')).toHaveText('—');
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await expect(metric.locator('.res-val')).toHaveAttribute('title', /^1 non-autoattack actions/);
  await page.locator('.pal-skill[data-skill="Flying Cutter"]').click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await expect(metric.locator('.res-val')).toHaveAttribute('title', /^1 non-autoattack actions/);
  const expected = await page.evaluate(
    () => `${Math.round(window.professionApp.results.rotationApm.apm).toLocaleString()} APM`
  );
  await expect(metric.locator('.res-val')).toHaveText(expected);
  await metric.locator('summary').focus();
  await page.keyboard.press('Enter');
  const panel = metric.locator('.res-metric-info-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Peak APM over 5s');
  await expect(panel).not.toContainText('bucket');
  const bounds = await metric.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1130);
  const panelBounds = await panel.boundingBox();
  expect(panelBounds.x).toBeGreaterThanOrEqual(0);
  expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(1130);
  expect(panelBounds.y).toBeGreaterThanOrEqual(0);
  expect(await panel.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  await page.locator('#btn-sim-clear').click();
  await expect(metric.locator('.res-val')).toHaveText('—');
});
