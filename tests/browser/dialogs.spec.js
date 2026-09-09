import { expect, test } from '@playwright/test';

const launchers = [
  ['[data-tutorial-trigger]', '.tutorial-dialog'],
  ['.build-template-import', '.build-template-import-dialog'],
  ['#btn-import-rotation', '.rotation-import-dialog[data-rotation-import-destination="current"]'],
  ['.rotation-hotkey-button', '.rotation-hotkey-dialog'],
  ['.build-tab-menu-trigger', '.build-rename-dialog']
];

// Each migrated feature keeps native focus and dismissal, including clicks on the shell's own padding.
test('shared modals dismiss consistently and return focus to their launcher', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const [triggerSelector, dialogSelector] of launchers) {
    const trigger = page.locator(triggerSelector).first();
    const dialog = page.locator(dialogSelector);
    for (const dismiss of ['button', 'escape', 'backdrop']) {
      await trigger.focus();
      await trigger.click();
      if (dialogSelector === '.build-rename-dialog')
        await page.locator('#build-tab-menu').getByRole('button', { name: 'Rename', exact: true }).click();
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((element) => element.matches(':modal') && element.contains(document.activeElement))
      ).toBe(true);
      await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        element.dispatchEvent(
          new MouseEvent('click', { bubbles: true, clientX: bounds.left + 2, clientY: bounds.top + 2 })
        );
      });
      await expect(dialog).toBeVisible();
      if (dismiss === 'button') await dialog.locator('[data-dialog-close]:visible').first().click();
      else if (dismiss === 'escape') await page.keyboard.press('Escape');
      else {
        const bounds = await dialog.boundingBox();
        await page.mouse.click(bounds.x - 5, bounds.y + 5);
      }

      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  }
});

// The formerly standalone-only modals must open within a tall iframe's visible host area before autofocus runs.
test('shared modals stay visible in a scrolled iframe and release viewport tracking on close', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.route('**/dialog-host', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<style>body { margin:0; padding-top:60px; } iframe { width:90%; height:3000px; border:0; }</style><iframe src="/mesmer.html?embed=1"></iframe>'
    })
  );
  await page.goto('/dialog-host');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => scrollTo(0, 500));
  for (const [triggerSelector, dialogSelector] of launchers) {
    const trigger = frame.locator(triggerSelector).first();
    const dialog = frame.locator(dialogSelector);
    await trigger.focus();
    await trigger.scrollIntoViewIfNeeded();
    const hostScroll = await page.evaluate(() => scrollY);
    await trigger.click();
    if (dialogSelector === '.build-rename-dialog')
      await frame.locator('#build-tab-menu').getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(hostScroll);
    const expectWithinHost = async () => {
      await expect
        .poll(async () => {
          const bounds = await dialog.boundingBox();
          return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height + 1);
        })
        .toBe(true);
    };

    await expectWithinHost();
    await page.setViewportSize({ width: 700, height: 500 });
    await expectWithinHost();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    if (await dialog.count()) await expect(dialog).not.toHaveAttribute('style', /--embed-viewport/);
    await expect(trigger).toBeFocused();
  }
});
