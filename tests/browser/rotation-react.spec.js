import { expect, test } from '@playwright/test';

// Opens the real worker-backed editor and waits until React palette targets are ready for interaction.
async function openProfession(page, profession = 'mesmer') {
  await page.goto(`/${profession}.html`);
  await page.waitForFunction(() => Boolean(window.professionApp?.results));
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#rotation-palette .pal-skill').first()).toBeVisible();
}

async function waitForSimulation(page) {
  await page.waitForFunction(
    () =>
      window.professionApp.resultRevision === window.professionApp.buildRevision &&
      !['queued', 'running'].includes(window.professionApp.simulationStatus)
  );
}

test('palette hotkeys, insertion, deferred rendering, and history preserve the authored timeline', async ({ page }) => {
  await openProfession(page);
  await page.evaluate(() => {
    window.professionApp.build.rotation = [];
    window.professionApp._rotationHistory = undefined;
    window.professionApp.changed();
  });
  await waitForSimulation(page);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);

  const bladecall = page.locator('.pal-skill[data-skill="Bladecall"]');
  await expect(bladecall).toHaveAttribute('data-hotkey-action', 'weapon-2');
  await expect(bladecall.locator('.pal-hotkey')).toHaveText('2');
  await bladecall.dispatchEvent('pointerdown');
  await page.keyboard.press('2');
  await page.waitForFunction(() => window.professionApp.build.rotation.length === 1);
  await waitForSimulation(page);
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);

  await page.locator('.rot-insertion-gap[data-insertion-index="0"]').click();
  const firstGap = page.locator('.rot-insertion-gap[data-insertion-index="0"]');
  const trailingGap = page.locator('.rot-insertion-gap[data-insertion-index="1"]');
  await expect(firstGap).toHaveClass(/active/);
  await expect(firstGap).toBeFocused();
  // Arrow navigation must move both selection and focus so the old focus-visible marker disappears.
  await page.keyboard.press('ArrowRight');
  await expect(trailingGap).toHaveClass(/active/);
  await expect(trailingGap).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(firstGap).toHaveClass(/active/);
  await expect(firstGap).toBeFocused();
  const alternate = page
    .locator(
      '.pal-skill[data-skill]:not([data-skill="Bladecall"]):not([data-skill^="__"]):not(.pal-context-disabled):not(.pal-concealed)'
    )
    .first();
  const alternateName = await alternate.getAttribute('data-skill');
  const deferred = await alternate.evaluate((skill) => {
    skill.click();
    return {
      buildLength: window.professionApp.build.rotation.length,
      visibleLength: document.querySelectorAll('#rotation-timeline .rot-skill[data-idx]').length,
      stale: window.professionApp.resultRevision < window.professionApp.buildRevision
    };
  });
  expect(deferred).toEqual({ buildLength: 2, visibleLength: 1, stale: true });
  await waitForSimulation(page);
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(2);
  expect(
    await page.evaluate(() => {
      const first = window.professionApp.build.rotation[0];
      return first.type === 'cast' ? window.professionApp.skillById.get(Number(first.skillId))?.name : first.type;
    })
  ).toBe(alternateName);

  const undo = page.locator('#btn-sim-undo');
  const redo = page.locator('#btn-sim-redo');
  await expect(undo).toBeEnabled();
  await undo.click();
  await page.waitForFunction(() => window.professionApp.build.rotation.length === 1);
  await waitForSimulation(page);
  await expect(redo).toBeEnabled();
  await redo.click();
  await page.waitForFunction(() => window.professionApp.build.rotation.length === 2);
  await waitForSimulation(page);
});

test('timeline drag/drop and floating wait editors keep their behavioral contracts', async ({ page }) => {
  await openProfession(page);
  const names = ['Bladecall', 'Flying Cutter', 'Unstable Bladestorm'];
  await page.evaluate((skillNames) => {
    window.professionApp.build.rotation = skillNames.map((name) => ({
      type: 'cast',
      skillId: window.professionApp.skillByName.get(name).id
    }));
    window.professionApp.changed();
  }, names);
  await waitForSimulation(page);
  await page.evaluate(() => {
    const source = document.querySelector('#rotation-timeline .rot-skill[data-idx="0"]');
    const target = document.querySelector('#rotation-timeline .rot-skill[data-idx="2"]');
    const transfer = new DataTransfer();
    const dispatch = (element, type, clientX = 0) =>
      element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, clientX }));
    dispatch(source, 'dragstart');
    dispatch(target, 'dragover', target.getBoundingClientRect().right + 1);
    dispatch(target, 'drop', target.getBoundingClientRect().right + 1);
    dispatch(source, 'dragend');
  });
  await waitForSimulation(page);
  expect(
    await page.evaluate(() =>
      window.professionApp.build.rotation.map((command) =>
        command.type === 'cast' ? window.professionApp.skillById.get(Number(command.skillId))?.name : command.type
      )
    )
  ).toEqual(['Flying Cutter', 'Unstable Bladestorm', 'Bladecall']);

  const waitTile = page.locator('.pal-skill[data-skill="__wait"]');
  await waitTile.click();
  const addDialog = page.getByRole('dialog', { name: 'Add wait' });
  await expect(addDialog).toBeVisible();
  await expect(addDialog.locator('input')).toBeFocused();
  const paletteBox = await waitTile.boundingBox();
  const addDialogBox = await addDialog.boundingBox();
  expect(
    Math.min(
      Math.abs(addDialogBox.x - paletteBox.x - paletteBox.width),
      Math.abs(paletteBox.x - addDialogBox.x - addDialogBox.width)
    )
  ).toBeLessThanOrEqual(14);
  await addDialog.locator('input').fill('600');
  await addDialog.getByRole('button', { name: 'Apply' }).click();
  await page.waitForFunction(() => window.professionApp.build.rotation.at(-1)?.type === 'wait');
  await waitForSimulation(page);

  const waitIndex = await page.evaluate(() => window.professionApp.build.rotation.length - 1);
  const waitCard = page.locator(`#rotation-timeline .rot-skill[data-idx="${waitIndex}"]`);
  await waitCard.getByRole('button', { name: 'Edit Wait duration' }).dispatchEvent('click');
  const editDialog = page.getByRole('dialog', { name: 'Edit wait' });
  await expect(editDialog.locator('input')).toHaveValue('600');
  const cardBox = await waitCard.boundingBox();
  const editDialogBox = await editDialog.boundingBox();
  expect(
    Math.min(
      Math.abs(editDialogBox.x - cardBox.x - cardBox.width),
      Math.abs(cardBox.x - editDialogBox.x - editDialogBox.width)
    )
  ).toBeLessThanOrEqual(14);
  await editDialog.locator('input').fill('900');
  await editDialog.getByRole('button', { name: 'Apply' }).click();
  await page.waitForFunction(() => window.professionApp.build.rotation.at(-1)?.durationMs === 900);
});

test('proc overlays, filters, and starting resources rerender without losing local UI state', async ({ page }) => {
  await openProfession(page);
  await page.evaluate(() => {
    window.professionApp.build.rotation = [];
    window.professionApp.changed();
  });
  await waitForSimulation(page);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await waitForSimulation(page);
  await page.evaluate(async () => {
    window.professionApp.overlayRelicProcs = true;
    window.professionApp.overlaySigilProcs = true;
    const { renderTimeline } = await import('/js/games/gw2/app/rotation/timeline/view.tsx');
    renderTimeline(window.professionApp);
  });

  const procPanel = page.locator('#rotation-procs .rotation-procs-wrap');
  await expect(procPanel).toBeAttached();
  await procPanel.locator(':scope > summary').click();
  await expect(procPanel).toHaveAttribute('open', '');
  const overlay = page.locator('#rotation-timeline .rot-proc-overlay').first();
  await expect(overlay).toBeAttached();
  const procKey = await overlay.getAttribute('data-proc-key');
  const procIcon = page.locator(`#rotation-procs .proc-icon[data-proc-key="${procKey}"]`).first();
  await procIcon.click();
  await expect(procIcon).toHaveClass(/proc-highlight/);
  await overlay.click();
  await expect(page.locator(`#rotation-timeline .rot-proc-overlay[data-proc-key="${procKey}"]`).first()).toHaveClass(
    /skill-highlight/
  );

  const filter = procPanel.locator('.proc-filter');
  await filter.locator(':scope > summary').click();
  const checkbox = filter.locator(`input[data-proc-key="${procKey}"]`);
  await checkbox.uncheck();
  await expect(procPanel).toHaveAttribute('open', '');
  await expect(procIcon).toBeHidden();
  await expect(page.locator(`#rotation-timeline .rot-proc-overlay[data-proc-key="${procKey}"]`).first()).toBeHidden();

  const resourcePip = page.locator('#start-att-selector .resource-pip[data-count="2"]').first();
  await resourcePip.click();
  await expect(resourcePip).toBeFocused();
  expect(await page.evaluate(() => window.professionApp.build.initialResource)).toBe(2);
});
