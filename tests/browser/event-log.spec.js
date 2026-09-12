import { expect, test } from '@playwright/test';

// Real layout verifies that rebuilding log rows retains scrolling and navigation works at both edges.
test('event log preserves reading position and follows the end across updates', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { mountEventLog } = await import('/js/games/gw2/app/results/event-log-view.ts');
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
