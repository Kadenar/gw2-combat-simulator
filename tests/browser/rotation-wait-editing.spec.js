import { expect, test } from '@playwright/test';

// Every wait-shape editor must reject off-grid durations and offer native 40 ms stepping.
test('adding, dropping, and editing wait shapes enforces 40 ms increments', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  for (const mode of ['add', 'drop', 'edit']) {
    await page.evaluate(() => {
      const app = window.professionApp;
      app.build.rotation = [{ type: 'wait', durationMs: 101 }];
      app.changed(false);
    });
    await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
    if (mode === 'add') {
      await page.locator('#rotation-palette .pal-skill[data-skill="__wait"]').click();
    } else if (mode === 'drop') {
      await page.evaluate(async () => {
        const { resolvePaletteDrop } = await import('/js/games/gw2/app/rotation/palette/interactions.ts');
        resolvePaletteDrop(window.professionApp, '__wait', null, 1);
      });
    } else {
      await page.locator('#rotation-timeline .rot-edit-wait').click();
    }

    const editor = page.locator('.rotation-duration-editor:visible');
    const input = editor.locator('input');
    await expect(input).toHaveAttribute('step', '40');
    await expect(input).toHaveAttribute('min', '40');
    await input.fill('101');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('80');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('40');
    await input.press('ArrowDown');
    await expect(input).toHaveValue('40');
    await input.fill('100');
    await editor.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(editor.locator('.activation-editor-error')).toContainText('divisible by 40 ms');
    expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual([{ type: 'wait', durationMs: 101 }]);
    await input.press('ArrowUp');
    await expect(input).toHaveValue('120');
    await input.press('Enter');
    await expect(editor).toHaveCount(0);
    expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1))).toEqual({
      type: 'wait',
      durationMs: 120
    });
  }
});
