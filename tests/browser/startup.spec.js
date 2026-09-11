import { expect, test } from '@playwright/test';

const moduleUrl = '**/js/games/gw2/professions/engineer/app/app-definition.ts*';

// Persistent failures stop after one automatic reload and leave keyboard-accessible manual recovery.
test('startup retries once before showing an error and manual reload recovers', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  let attempts = 0;
  await page.route(moduleUrl, (route) => {
    attempts++;
    return route.abort();
  });
  await page.goto('/engineer.html?embed=1', { waitUntil: 'domcontentloaded' });

  const overlay = page.locator('#loading-overlay');
  await expect(overlay.getByRole('alert')).toHaveText('Unable to start the simulator. Reload to try again.');
  await expect(overlay.locator('.spinner')).toHaveCount(0);
  const reload = overlay.getByRole('button', { name: 'Reload', exact: true });
  await expect(reload).toBeFocused();
  expect(attempts).toBe(2);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.some((message) => message.includes('Simulator startup failed:'))).toBe(true);

  await page.unroute(moduleUrl);
  await reload.press('Enter');
  await expect(overlay).toHaveClass(/hidden/);
  await expect(page.locator('#build-workspace-tabs')).toBeVisible();
  await expect(page).toHaveURL(/\/engineer\.html\?embed=1$/);
  expect(pageErrors).toEqual([]);
});

test('a transient startup failure recovers automatically and a ready page stays mounted on resume', async ({
  page
}) => {
  let attempts = 0;
  await page.route(moduleUrl, (route) => (++attempts === 1 ? route.abort() : route.continue()));
  await page.goto('/engineer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => sessionStorage.getItem('simulator-startup-retry:/engineer.html'))).toBeNull();

  await page.clock.install();
  await page.clock.fastForward(31_000);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#build-workspace-tabs')).toBeVisible();
  expect(attempts).toBe(2);
});

// A never-settling module covers stalled initialization independently of network rejection handling.
for (const trigger of ['timeout', 'pageshow', 'visibilitychange']) {
  test(`stalled startup recovers automatically on ${trigger}`, async ({ page }) => {
    await page.clock.install();
    let attempts = 0;
    await page.route(moduleUrl, (route) => {
      attempts++;
      return attempts === 1
        ? route.fulfill({ contentType: 'application/javascript', body: 'await new Promise(() => {});' })
        : route.continue();
    });
    await page.goto('/engineer.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => attempts).toBe(1);

    if (trigger === 'timeout') {
      await page.clock.fastForward(31_000);
    } else {
      await page.evaluate(() =>
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      );
      await page.clock.fastForward(31_000);
      expect(attempts).toBe(1);
      await page.evaluate((event) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        if (event === 'pageshow') window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        else document.dispatchEvent(new Event('visibilitychange'));
      }, trigger);
    }

    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#build-workspace-tabs')).toBeVisible();
    expect(attempts).toBe(2);
  });
}

test('startup failure remains recoverable when session storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('Session storage unavailable');
      }
    });
  });
  let attempts = 0;
  await page.route(moduleUrl, (route) => {
    attempts++;
    return route.abort();
  });
  await page.goto('/engineer.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeFocused();
  expect(attempts).toBe(1);
});
