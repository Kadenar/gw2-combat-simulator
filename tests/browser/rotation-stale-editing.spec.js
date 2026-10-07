import { expect, test } from '@playwright/test';

// Keep the old palette visible across a swap to test native input rejection, failure feedback, and recovery.
test('palette waits for fresh state before accepting hotkeys, clicks, or drags', async ({ page }) => {
  await page.goto('/revenant.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const build = await (await fetch('/data/gw2/builds/revenant/b-power-vindicator-greatsword-energy.json')).json();
    app.build = app.adapter.toApplicationBuild({ ...build, rotation: [] });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await page.evaluate(() => {
    const app = window.professionApp;
    const runner = app.baselineSimulationRunner;
    runner.schedule = () => {};

    window.resumeBaseline = () => {
      delete runner.schedule;
      runner.schedule(app.buildRevision);
    };

    document.addEventListener('keydown', (event) => {
      if (event.code === 'F1') window.blockedFunctionKey = event.defaultPrevented;
    });
  });
  const palette = page.locator('#rotation-palette');
  const status = page.locator('.rotation-builder-heading [data-palette-update-status]');
  await palette.dispatchEvent('pointerdown', { button: 0 });
  await page.keyboard.press('Backquote');
  await expect(status).toHaveText('Updating skills…');
  await expect(status).toBeVisible();
  await expect(palette).toHaveAttribute('aria-busy', 'true');
  await page.keyboard.press('Digit1');
  await page.keyboard.press('F1');
  expect(await page.evaluate(() => window.blockedFunctionKey)).toBe(true);
  await palette.locator('[data-skill-id="62913"]').click();
  expect(
    await palette
      .locator('[data-skill-id="62913"]')
      .evaluate((tile) => tile.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true })))
  ).toBe(false);
  expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual([{ type: 'cast', skillId: -3 }]);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.failBaselineSimulation(new Error('Fixture failure'), app.buildRevision);
  });
  await expect(status).toHaveText('Simulation failed');
  await expect(palette).toHaveAttribute('aria-busy', 'false');
  await page.keyboard.press('Digit1');
  expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual([{ type: 'cast', skillId: -3 }]);
  await page.evaluate(() => window.resumeBaseline());
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  await expect(status).toBeHidden();
  await palette.dispatchEvent('pointerdown', { button: 0 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.professionApp.simulationStatus === 'idle');
  expect(await page.evaluate(() => window.professionApp.build.rotation.at(-1).skillId)).toBe(29057);
  expect(await page.evaluate(() => window.professionApp.results.warnings)).toEqual([]);
});

// Hold edit-triggered simulation publication so stale controls are exercised deterministically.
test('retained timeline controls reject stale indexes and resume after publication', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation = [1000, 2000, 3000].map((durationMs) => ({ type: 'wait', durationMs }));
    app.changed(false);
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  const held = await page.evaluate(() => {
    const app = window.professionApp;
    const runner = app.baselineSimulationRunner;
    window.resumeBaseline = () => {
      delete runner.schedule;
      runner.schedule(app.buildRevision);
    };

    runner.schedule = () => {};

    const root = document.getElementById('rotation-timeline');
    const cards = root.querySelectorAll('.rot-skill[data-idx]:not(.rot-injected)');
    // Open an editor and begin a drag before removal invalidates both captured indexes.
    cards[1].querySelector('.rot-edit-wait').click();
    const editor = document.querySelector('.rotation-duration-editor');
    cards[1].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }));
    const dragStarted = app.dragState?.index === 1;
    cards[0].querySelector('.rot-x').click();
    const revision = app.buildRevision;
    const dragCleared = app.dragState === null;
    cards[1].querySelector('.rot-x').click();
    cards[1].querySelector('.rot-x').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    editor.querySelector('input').value = '9000';
    editor.querySelector('.activation-editor-apply').click();
    cards[1].querySelector('.rot-edit-wait').click();
    const editorReopened = !!document.querySelector('.rotation-duration-editor:popover-open');
    const staleDragAccepted = cards[1].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }));
    // A palette drag can begin while the old timeline is retained; its target index is still stale.
    app.dragState = { source: 'palette', name: '__wait', durationMs: 4000 };
    cards[1].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: 0 }));
    root.querySelector('.rot-insertion-gap[data-insertion-index="1"]').click();
    return {
      durations: app.build.rotation.map((entry) => entry.durationMs),
      revisionUnchanged: app.buildRevision === revision,
      retainedCards: [...cards].every((card) => card.isConnected),
      cursor: app.rotationInsertionIndex,
      dragStarted,
      dragCleared,
      editorReopened,
      staleDragAccepted
    };
  });
  expect(held).toEqual({
    durations: [2000, 3000],
    revisionUnchanged: true,
    retainedCards: true,
    cursor: null,
    dragStarted: true,
    dragCleared: true,
    editorReopened: false,
    staleDragAccepted: false
  });

  await page.evaluate(() => window.resumeBaseline());
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await page.locator('#rotation-timeline .rot-skill[data-idx="0"] .rot-x').click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  expect(await page.evaluate(() => window.professionApp.build.rotation)).toEqual([{ type: 'wait', durationMs: 3000 }]);
});
