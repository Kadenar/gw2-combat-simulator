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
      // Exercise the DOM drag handlers independently of Chrome's mouse gesture recognition.
      const wait = page.locator('#rotation-palette .pal-skill[data-skill="__wait"]');
      const timeline = page.locator('#rotation-timeline');
      const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
      await wait.dispatchEvent('dragstart', { dataTransfer });
      await timeline.dispatchEvent('dragover', { dataTransfer });
      await timeline.dispatchEvent('drop', { dataTransfer });
      await wait.dispatchEvent('dragend', { dataTransfer });
      await dataTransfer.dispose();
    } else {
      const edit = page.locator('#rotation-timeline .rot-edit-wait');
      await edit.focus();
      await edit.press('Enter');
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
