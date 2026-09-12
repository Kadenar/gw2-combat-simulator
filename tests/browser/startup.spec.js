import { expect, test } from '@playwright/test';

const moduleUrl = '**/js/games/gw2/professions/engineer/app/app-definition.ts*';

// A tall cross-origin iframe must center startup in the visible host area as the host scrolls and resizes.
test('embedded loader follows the visible host viewport until startup completes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(['local-network-access'], { origin: 'http://localhost:4173' });
  let releaseModule;
  const moduleReady = new Promise((resolve) => (releaseModule = resolve));
  await page.route(moduleUrl, async (route) => {
    await moduleReady;
    await route.continue();
  });
  await page.route('http://localhost:4173/loader-host', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<style>body { margin: 0; padding-top: 60px; } iframe { width: 100%; height: 3000px; border: 0; }</style>
        <iframe title="Simulator" src="http://127.0.0.1:4173/engineer.html?embed=1"></iframe>`
    })
  );
  try {
    await page.goto('http://localhost:4173/loader-host', { waitUntil: 'domcontentloaded' });
    const frame = page.frameLocator('iframe');
    const overlay = frame.locator('#loading-overlay');
    const workspace = frame.locator('.loader-workspace');
    await expect(overlay).toBeVisible();
    const expectCentered = async () => {
      await expect
        .poll(async () => {
          const host = await page.locator('iframe').boundingBox();
          const content = await workspace.boundingBox();
          if (!host || !content) return false;
          const top = Math.max(0, host.y);
          const bottom = Math.min(page.viewportSize().height, host.y + host.height);
          return (
            content.y >= top &&
            content.y + content.height <= bottom + 1 &&
            Math.abs(content.y + content.height / 2 - (top + bottom) / 2) < 2
          );
        })
        .toBe(true);
    };

    await expectCentered();
    await page.evaluate(() => scrollTo(0, 500));
    await expectCentered();
    await page.setViewportSize({ width: 390, height: 700 });
    await expectCentered();
    releaseModule();
    await expect(overlay).toBeHidden();
    await expect.poll(() => overlay.evaluate((element) => element.style.inset)).toBe('');
  } finally {
    releaseModule();
  }
});

// Hold real startup dependencies so loading, reduced motion, and the handoff can be checked without artificial delays.
test('loading workspace follows startup and stays accessible on narrow screens', async ({ page }, testInfo) => {
  let releaseModule;
  let releaseTemplates;
  const moduleReady = new Promise((resolve) => (releaseModule = resolve));
  const templatesReady = new Promise((resolve) => (releaseTemplates = resolve));
  await page.route(moduleUrl, async (route) => {
    await moduleReady;
    await route.continue();
  });
  // Include the cache-busting query so template loading holds the preparing state until explicitly released.
  await page.route('**/data/gw2/builds/engineer/manifest.json*', async (route) => {
    await templatesReady;
    await route.continue();
  });
  try {
    await page.setViewportSize({ width: 1130, height: 760 });
    await page.goto('/engineer.html?embed=1', { waitUntil: 'domcontentloaded' });
    const overlay = page.locator('#loading-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('status')).toHaveText('Loading Engineer data…');
    await expect(overlay.getByRole('status')).toBeVisible();
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    const slot = overlay.locator('.loader-skill-bar > span').first();
    await expect(slot).toHaveCSS('animation-name', 'loader-skill-assemble');
    await expect
      .poll(() => overlay.locator('.loader-crest').evaluate((image) => image.naturalWidth))
      .toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('loading-desktop.png') });

    await page.setViewportSize({ width: 320, height: 568 });
    const preview = await overlay.locator('.loader-preview').boundingBox();
    expect(preview.x).toBeGreaterThanOrEqual(0);
    expect(preview.x + preview.width).toBeLessThanOrEqual(320);
    await expect(overlay.getByRole('status')).toBeInViewport();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(slot).toHaveCSS('animation-name', 'none');
    await expect.poll(() => overlay.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('loading-mobile.png') });

    releaseModule();
    await expect(overlay.getByRole('status')).toHaveText('Preparing your build workspace…');
    releaseTemplates();
    await expect(overlay).toBeHidden();
    await expect(page.locator('#app')).not.toHaveAttribute('inert');
    await expect(page.locator('#build-workspace-tabs')).toBeVisible();
  } finally {
    releaseModule();
    releaseTemplates();
  }
});

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
