import { expect, test } from '@playwright/test';

// The shared toolbar must load templates without leaving a tool view or hiding its picker and feedback.
test('templates load from the optimizer and Analysis toolbars', async ({ page }) => {
  await page.route('**/data/gw2/builds/mesmer/manifest.json*', (route) =>
    route.fulfill({
      json: [
        { section: 'Mirage', presets: [{ label: 'Power (Spear)', build: 'data/gw2/builds/mesmer/b-tool-test.json' }] }
      ]
    })
  );
  await page.route('**/data/gw2/builds/mesmer/b-tool-test.json*', async (route) => {
    const build = await page.evaluate(() => window.professionApp.build);
    await route.fulfill({ json: { ...build, targetArmor: 2400 } });
  });
  await page.goto('/mesmer.html#gear-optimizer');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const originalArmor = await page.evaluate(() => window.professionApp.build.targetArmor);
  const dialog = page.getByRole('dialog', { name: 'Build templates', exact: true });
  for (const view of ['Gear Optimizer', 'Analysis']) {
    const tab = page.getByRole('link', { name: view, exact: true });
    await tab.click();
    await page.locator('.build-tab.is-active .build-tab-menu-trigger').click();
    await page.getByRole('button', { name: 'Load template…', exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.locator('.template-load-btn').click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.template-toast')).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(originalArmor);
    await page.locator('.build-tab-new').click();
    await page.getByRole('button', { name: 'Browse templates…', exact: true }).click();
    await expect(dialog).toBeVisible();
    const previousCount = await page.locator('.build-tab').count();
    await dialog.locator('.template-load-btn').click();
    await expect(page.locator('.build-tab')).toHaveCount(previousCount + 1);
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => page.evaluate(() => window.professionApp.build.targetArmor)).toBe(2400);
    await page.locator('.build-tab').first().locator('[data-build-tab-action="select"]').click();
  }
});

// Standalone layouts keep the editor full width and preserve catalog filters across viewport changes.
test('standalone templates open only in a dialog at every viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const container = page.locator('.build-templates');
  const dialog = page.locator('#build-templates-dialog');
  const newButton = page.locator('.build-tab-new');
  for (const width of [390, 1199, 1200, 1600]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(dialog).toBeHidden();
    await expect(container.locator(':scope > .build-templates-panel')).toHaveCount(0);
    expect((await container.boundingBox()).height).toBe(0);
    const layout = await page.locator('.profession-layout').boundingBox();
    const main = await page.locator('.profession-main').boundingBox();
    expect(main.x).toBe(layout.x);
    expect(main.width).toBe(layout.width);
    await newButton.click();
    await page.getByRole('button', { name: /Browse templates/ }).click();
    await expect(dialog).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Close build templates' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(newButton).toBeFocused();
  }

  await newButton.click();
  await page.getByRole('button', { name: /Browse templates/ }).click();
  await dialog.locator('.template-filter').first().locator('summary').click();
  await dialog.locator('[data-template-filter="power"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeInViewport();
  await expect(dialog.locator('[data-template-role-value]')).toHaveText('Power');
  await dialog.getByRole('button', { name: 'Close build templates' }).click();
  await expect(newButton).toBeFocused();
});

// Cross-origin, auto-height hosts must keep the picker in the visible browser area as the host scrolls and resizes.
test('template dialog follows the visible viewport inside a tall cross-origin iframe', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  // The intercepted host has no network address; allow this test page to reach the local simulator server.
  await page.context().grantPermissions(['local-network-access'], { origin: 'http://localhost:4173' });
  await page.route('http://localhost:4173/embed-host', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<style>body { margin: 0; padding-top: 60px; } iframe { width: 90%; height: 3000px; border: 0; }</style>
      <iframe title="Simulator" src="http://127.0.0.1:4173/mesmer.html?embed=1"></iframe>`
    })
  );
  await page.goto('http://localhost:4173/embed-host');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#loading-overlay')).toHaveClass(/hidden/);
  const browse = frame.getByRole('button', { name: /Browse templates/ });
  const dialog = frame.getByRole('dialog', { name: 'Build templates' });
  await frame.locator('.build-tab-new').click();
  await browse.click();

  const expectVisibleCenter = async () => {
    await expect
      .poll(async () => {
        const host = await page.locator('iframe').boundingBox();
        const modal = await dialog.boundingBox();
        if (!host || !modal) return false;
        const viewport = page.viewportSize();
        const top = Math.max(0, host.y);
        const bottom = Math.min(viewport.height, host.y + host.height);
        return (
          Math.abs(modal.y + modal.height / 2 - (top + bottom) / 2) < 2 &&
          modal.y >= top + 11 &&
          modal.y + modal.height <= bottom - 11
        );
      })
      .toBe(true);
  };

  await expectVisibleCenter();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(() => scrollTo(0, 500));
  await expectVisibleCenter();
  await page.evaluate(() => scrollTo(0, 900));
  await expectVisibleCenter();
  await page.setViewportSize({ width: 700, height: 500 });
  await expectVisibleCenter();
  await dialog.getByRole('button', { name: 'Close build templates' }).click();
  await expect(dialog).toBeHidden();
  await page.evaluate(() => scrollTo(0, 0));
  await frame.locator('.build-tab-new').click();
  await browse.click();
  await expectVisibleCenter();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(frame.locator('.build-tab-new')).toBeFocused();
});

// A long catalog stays out of the embedded editor and remains usable with keyboard, scrolling, and partial loading.
test('embedded templates browse in a bounded dialog and return to the editor after loading', async ({ page }) => {
  await page.route('**/data/gw2/builds/mesmer/manifest.json*', (route) =>
    route.fulfill({
      json: [
        {
          section: 'Mirage',
          presets: Array.from({ length: 30 }, (_, index) => ({
            label: `Power (Spear) - ${index + 1}`,
            build: 'data/gw2/builds/mesmer/b-power-mirage-spear-greatsword.json'
          }))
        }
      ]
    })
  );
  await page.goto('/');
  await page.setContent('<iframe title="Simulator" src="/mesmer.html?embed=1"></iframe>');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#loading-overlay')).toHaveClass(/hidden/);
  const templates = frame.locator('.build-templates');
  const browse = frame.getByRole('button', { name: /Browse templates/ });
  const dialog = frame.getByRole('dialog', { name: 'Build templates' });
  const close = dialog.getByRole('button', { name: 'Close build templates' });

  for (const [width, height] of [
    [800, 600],
    [320, 400],
    [1400, 900]
  ]) {
    await page.setViewportSize({ width: width + 32, height: height + 32 });
    await page.locator('iframe').evaluate(
      (iframe, [width, height]) => {
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
      },
      [width, height]
    );
    await expect(dialog).toBeHidden();
    expect((await templates.boundingBox()).height).toBeLessThan(60);
    const editorBounds = await frame.locator('.profession-main').boundingBox();
    const templateBounds = await templates.boundingBox();
    expect(editorBounds.y).toBeGreaterThanOrEqual(templateBounds.y + templateBounds.height);
    expect(editorBounds.x).toBe(templateBounds.x);

    await frame.locator('.build-tab-new').click();
    await browse.click();
    await expect(close).toBeFocused();
    expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
    expect(
      await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight &&
          Math.abs(rect.left + rect.width / 2 - innerWidth / 2) < 1 &&
          Math.abs(rect.top + rect.height / 2 - innerHeight / 2) < 1 &&
          element.scrollHeight > element.clientHeight &&
          element.scrollWidth === element.clientWidth
        );
      })
    ).toBe(true);
    await dialog.locator('.template-actions > summary').last().click();
    await expect(dialog.getByRole('menuitem', { name: 'Load build only' }).last()).toBeVisible();
    await expect(close).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(frame.locator('.build-tab-new')).toBeFocused();
  }

  await frame.locator('.build-tab-new').click();
  await browse.click();
  await dialog.locator('.template-actions > summary').first().click();
  await dialog.getByRole('menuitem', { name: 'Load build only' }).first().click();
  await expect(dialog).toBeHidden();
  await expect(frame.locator('.build-tab-new')).toBeFocused();
  await expect(templates.getByRole('status')).toContainText('build only');
  await templates.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(templates.getByRole('status')).toBeHidden();
  await frame.locator('.build-tab-new').click();
  await browse.click();
  await close.click();
  await expect(frame.locator('.build-tab-new')).toBeFocused();
  // The primary choice reached through New must preserve the existing build in its own tab.
  await frame.locator('.build-tab-new').click();
  await browse.click();
  await dialog.locator('.template-load-btn').first().click();
  await expect(dialog).toBeHidden();
  await expect(frame.locator('.build-tab')).toHaveCount(2);
  await expect(frame.locator('.build-tab-new')).toBeFocused();
});

// A small manifest exercises grouping and intersecting filters without depending on saved rotations.
test('weapon-first templates group by role, collapse, and hide empty filtered groups', async ({ page }) => {
  await page.route('**/data/gw2/builds/mesmer/manifest.json*', (route) =>
    route.fulfill({
      json: [
        {
          section: 'Chronomancer',
          presets: [
            { label: 'Power (Sword/Dagger)', build: 'power.json', benchmarkDps: 12345 },
            { label: 'Condition (Scepter/Torch)', build: 'condition.json' },
            { label: 'Power Quickness (Spear)', build: 'quickness.json' },
            { label: 'Condition Alacrity (Staff)', build: 'alacrity.json' }
          ]
        },
        { section: 'Mirage', presets: [{ label: 'Condition (Axe)', build: 'axe.json' }] }
      ]
    })
  );
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  const templates = page.locator('.build-templates');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.build-tab-new').click();
  await page.getByRole('button', { name: /Browse templates/ }).click();
  const chrono = templates.locator('.presets-group').filter({ hasText: 'Chronomancer' });
  const mirage = templates.locator('.presets-group').filter({ hasText: 'Mirage' });
  const power = chrono.locator('.template-subgroup').filter({ has: page.locator('summary', { hasText: /^Power$/ }) });
  const boon = chrono.locator('.template-subgroup').filter({ has: page.locator('summary', { hasText: /^Boon$/ }) });
  await expect(chrono.locator('.template-subgroup > summary')).toHaveText(['Power', 'Condition', 'Boon']);
  await expect(power.locator('.template-preset-name')).toHaveText('Sword & Dagger');
  await expect(power.locator('.template-preset-dps')).toHaveText('12,345 DPS');
  await expect(power.locator('.template-preset-boon')).toHaveCount(0);
  await expect(boon.locator('.template-preset-name')).toHaveText(['Spear', 'Staff']);
  await expect(boon.locator('.template-preset-boon')).toHaveText(['Quickness', 'Alacrity']);
  await expect(mirage.locator('.template-subgroup > summary')).toHaveText(['Condition']);

  await power.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(power.locator('.template-load-btn')).toBeHidden();
  await expect(boon.locator('.template-load-btn').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(power.locator('.template-load-btn')).toBeVisible();
  await expect(power.locator('.template-load-btn')).toHaveAttribute('title', 'Power (Sword/Dagger)');
  await power.locator('.template-actions > summary').click();
  await expect(power.getByRole('menuitem', { name: 'Open in new tab' })).toBeVisible();

  const selectFilter = async (attribute, value) => {
    const button = templates.locator(`[${attribute}="${value}"]`);
    await button.locator('xpath=ancestor::details/summary').click();
    await button.click();
  };

  await selectFilter('data-template-filter', 'power');
  await expect(mirage).toBeHidden();
  await expect(chrono.locator('.template-subgroup:not([hidden]) > summary')).toHaveText(['Power', 'Boon']);
  await expect(boon.locator('.template-preset:not([hidden]) .template-preset-name')).toHaveText(['Spear']);
  await selectFilter('data-template-boon-filter', 'alacrity');
  await expect(chrono).toBeHidden();
  await expect(templates.locator('.template-filter-empty')).toBeVisible();
  await selectFilter('data-template-filter', 'all');
  await expect(boon).toBeVisible();
  await expect(power).toBeHidden();
  await expect(boon.locator('.template-preset:not([hidden]) .template-preset-name')).toHaveText(['Staff']);
  await selectFilter('data-template-specialization-filter', 'Mirage');
  await expect(templates.locator('.template-filter-empty')).toBeVisible();
  await selectFilter('data-template-boon-filter', 'all');
  await expect(mirage).toBeVisible();
  await expect(chrono).toBeHidden();
  await expect(templates.locator('.template-filter-empty')).toBeHidden();
});
