import { expect, test } from '@playwright/test';

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
