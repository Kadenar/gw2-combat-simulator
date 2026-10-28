import { expect, test } from '@playwright/test';
import { openSimulator, openTemplates } from '#tests/helpers/browser-workspace.js';

// Cursor changes refresh both comparison previews without mutating rotations or invalidating simulation results.
test('insertion selection and clearing refresh comparison after timeline rerenders', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.evaluate(() => {
    const app = window.professionApp;
    const skill = app.build.rotation[0];
    app.build.rotation = [skill, { type: 'wait', durationMs: 1000 }, { ...skill }];
    app.changed(false);
  });
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.evaluate(() => window.professionApp.loadRotationReference(window.professionApp.build.rotation));
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();

  const current = page.locator('#rotation-timeline');
  const reference = page.locator('#rotation-reference-timeline');
  const damage = page.locator('[data-comparison-current-damage]');
  const finalDamage = await damage.textContent();
  const simulationState = () =>
    page.evaluate(() => {
      const app = window.professionApp;
      return {
        rotation: app.build.rotation,
        reference: app.rotationComparison.referenceRotation,
        buildRevision: app.buildRevision,
        resultRevision: app.resultRevision,
        simulationStatus: app.simulationStatus
      };
    });
  const before = await simulationState();

  await current.locator('.rot-insertion-gap[data-insertion-index="0"]').click();
  await expect(damage).not.toHaveText(finalDamage);
  await expect(current.locator('.rot-skill[data-idx="0"]')).toHaveClass(/rot-preview-active/);
  await expect(reference.locator('.rot-skill[data-idx="0"]')).toHaveClass(/rot-preview-active/);
  await expect(reference.locator('.rot-insertion-gap')).toHaveCount(0);

  // A direct timeline refresh must retain the controller callback for subsequent native cursor interactions.
  await page.evaluate(async () => {
    const { renderTimeline } = await import('/js/games/gw2/app/rotation/timeline/view.ts');
    renderTimeline(window.professionApp);
  });
  await current.locator('.rot-insertion-gap[data-insertion-index="1"]').click();
  await expect(current.locator('.rot-insertion-gap[data-insertion-index="1"]')).toHaveClass(/active/);
  await expect(reference.locator('.rot-preview-active')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(damage).toHaveText(finalDamage);
  await expect(current.locator('.rot-preview-active')).toHaveCount(0);
  await expect(reference.locator('.rot-preview-active')).toHaveCount(0);
  expect(await page.evaluate(() => window.professionApp.rotationInsertionIndex)).toBeNull();
  expect(await simulationState()).toEqual(before);
});

// Reference highlighting stays local, survives rendering, and never edits either rotation.
test('reference skills toggle matching highlights independently of the current rotation', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.evaluate(() => {
    const app = window.professionApp;
    const skill = app.build.rotation[0];
    app.build.rotation = [skill, { type: 'wait', durationMs: 1000 }, { ...skill }];
    app.changed(false);
  });
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.evaluate(() => window.professionApp.loadRotationReference(window.professionApp.build.rotation));
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();

  const current = page.locator('#rotation-timeline');
  const reference = page.locator('#rotation-reference-timeline');
  const referenceSkill = reference.locator('.rot-skill[data-idx="0"]');
  await current.locator('.rot-skill[data-idx="1"] img').click();
  const state = () =>
    page.evaluate(() => {
      const app = window.professionApp;
      return {
        current: app.build.rotation,
        reference: app.rotationComparison.referenceRotation,
        buildRevision: app.buildRevision,
        resultRevision: app.resultRevision,
        insertionIndex: app.rotationInsertionIndex,
        highlight: app.rotationSkillHighlightKey
      };
    });
  const before = await state();

  await referenceSkill.click();
  await expect(reference.locator('.skill-highlight')).toHaveCount(2);
  await expect(reference.locator('.rot-skill[data-idx="1"]')).toHaveClass(/skill-faded/);
  await expect(current.locator('.skill-highlight')).toHaveCount(1);
  await expect(current.locator('.rot-skill[data-idx="1"]')).toHaveClass(/skill-highlight/);
  await expect(reference.locator('[draggable="true"], .rot-x, .rot-edit-activation, .rot-edit-wait')).toHaveCount(0);

  await page.evaluate(() => window.professionApp.adapter.renderRotationBuilder(window.professionApp));
  await expect(reference.locator('.skill-highlight')).toHaveCount(2);
  await expect(current.locator('.rot-skill[data-idx="1"]')).toHaveClass(/skill-highlight/);
  await referenceSkill.click();
  await expect(reference.locator('.skill-highlight, .skill-faded')).toHaveCount(0);
  expect(await state()).toEqual(before);

  await referenceSkill.click();
  await page.locator('[data-comparison-reference-clear]').click();
  await page.evaluate(() => window.professionApp.loadRotationReference(window.professionApp.build.rotation));
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();
  await expect(reference.locator('.skill-highlight, .skill-faded')).toHaveCount(0);
});

test('rotation comparison keeps editable and read-only timelines stacked without page overflow', async ({ page }) => {
  await openSimulator(page);
  // Wider font metrics exercise wrapped mobile controls and timelines constrained to their minimum height.
  await page.addStyleTag({ content: 'body { font-family: Verdana, sans-serif; }' });
  // Start from a manifest build so the reference picker has one compatible skill loadout.
  await openTemplates(page);
  const templateButton = page.locator('.template-load-btn').first();
  await templateButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.professionApp.currentTemplate !== null && window.professionApp.simulationStatus === 'idle'
      )
    )
    .toBe(true);
  await page.evaluate(() => {
    const app = window.professionApp;
    const bladecall = app.activeCatalog.skillsById.get(62560);
    app.build.rotation = [
      { type: 'cast', skillId: bladecall.id },
      { type: 'wait', durationMs: 1000 }
    ];
    app.changed(false);
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const app = window.professionApp;
        return app.simulationStatus === 'idle' && app.resultRevision === app.buildRevision;
      })
    )
    .toBe(true);

  const modeButtons = page.locator('.rotation-builder-controls > :is(.rotation-focus-toggle, [data-rotation-compare])');
  await expect(modeButtons).toHaveText(['Focus', 'Compare']);
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(modeButtons).toHaveText(['Exit focus', 'Exit compare']);
  await expect(page.locator('body')).toHaveAttribute('data-rotation-comparison', '');
  await expect(page.getByRole('heading', { name: 'Current — Editing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reference — Read only' })).toBeVisible();
  const referenceSection = page.locator('#rotation-comparison-reference');
  const referenceTimeline = page.locator('#rotation-reference-timeline');
  await expect(referenceSection.getByText('Load a comparison', { exact: true })).toBeVisible();
  await expect(referenceTimeline).toBeHidden();
  await expect(referenceSection.getByRole('button', { name: 'Load rotation' })).toBeHidden();
  await expect(referenceSection.getByRole('button', { name: 'Swap' })).toBeHidden();
  await expect(referenceSection.getByRole('button', { name: 'Clear' })).toBeHidden();
  await expect(page.locator('#rotation-comparison-summary')).toBeHidden();

  await referenceSection.getByRole('button', { name: 'Load comparison' }).click();
  const loadDialog = page.getByRole('dialog', { name: 'Load reference rotation' });
  await expect(loadDialog).toBeVisible();
  await loadDialog.getByRole('tab', { name: 'Saved rotation', exact: true }).click();
  const existingRotations = loadDialog.getByLabel('Compatible rotation');
  await expect.poll(() => existingRotations.locator('option').count()).toBeGreaterThan(1);
  await existingRotations.selectOption({ index: 1 });
  await expect(loadDialog.getByRole('button', { name: 'Use as reference' })).toBeEnabled();
  await loadDialog.getByRole('button', { name: 'Use as reference' }).click();
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();
  await expect(page.locator('[data-comparison-status]')).toBeHidden();
  await expect(referenceSection.getByRole('button', { name: 'Load rotation' })).toBeVisible();
  await expect(referenceSection.getByRole('button', { name: 'Swap' })).toBeVisible();
  await expect(referenceSection.getByRole('button', { name: 'Clear' })).toBeVisible();
  await expect(page.locator('#rotation-comparison-summary')).toBeVisible();
  await expect(referenceTimeline).toHaveAttribute('aria-readonly', 'true');
  await expect(
    referenceTimeline.locator('.rot-insertion-gap, .rot-edit-activation, .rot-edit-wait, .rot-x')
  ).toHaveCount(0);
  expect(
    await referenceTimeline.locator('.rot-skill').evaluateAll((skills) => skills.every((skill) => !skill.draggable))
  ).toBe(true);

  const updatingStatus = await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation.push({ type: 'cast', skillId: app.activeCatalog.skillsById.get(10333).id });
    app.changed(false);
    return {
      status: document.querySelector('[data-comparison-status]')?.textContent,
      referenceDps: document.querySelector('[data-comparison-reference-dps]')?.textContent,
      currentDps: document.querySelector('[data-comparison-current-dps]')?.textContent
    };
  });
  expect(updatingStatus.status).toBe('Updating');
  expect(updatingStatus.referenceDps).not.toBe('');
  expect(updatingStatus.currentDps).not.toBe('');
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();
  await expect(page.locator('[data-comparison-status]')).toBeHidden();

  const finalValues = await page
    .locator('#rotation-comparison-summary')
    .evaluate((summary) => [
      summary.querySelector('[data-comparison-reference-dps]').textContent,
      summary.querySelector('[data-comparison-current-dps]').textContent
    ]);
  // Mouse and keyboard cursor changes update both comparisons without editing or resimulating the rotation.
  await expect(page.locator('.rotation-comparison-time, [data-comparison-metric-label]')).toHaveCount(0);
  const currentTimeline = page.locator('#rotation-timeline');
  const buildRevision = await page.evaluate(() => window.professionApp.buildRevision);
  await expect(page.locator('#rotation-comparison-summary input[type="range"]')).toHaveCount(0);
  await currentTimeline.locator('[data-insertion-index="0"]').click();
  await expect(page.locator('[data-comparison-reference-dps]')).toHaveText('0');
  await expect(page.locator('[data-comparison-current-dps]')).toHaveText('0');

  await page.keyboard.press('ArrowRight');
  await expect(currentTimeline.locator('.rot-insertion-gap.active')).toHaveAttribute('data-insertion-index', '1');
  await expect(currentTimeline.locator('.rot-preview-active').first()).toBeVisible();
  await expect(referenceTimeline.locator('.rot-preview-active').first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-comparison-reference-dps]')).toHaveText(finalValues[0]);
  await expect(page.locator('[data-comparison-current-dps]')).toHaveText(finalValues[1]);
  await expect(page.locator('.rot-preview-active')).toHaveCount(0);
  await currentTimeline.locator('[data-insertion-index="0"]').click();
  await currentTimeline.locator('.rot-insertion-gap').last().click();
  await expect(page.locator('[data-comparison-reference-dps]')).toHaveText(finalValues[0]);
  await expect(page.locator('[data-comparison-current-dps]')).toHaveText(finalValues[1]);
  expect(await page.evaluate(() => window.professionApp.buildRevision)).toBe(buildRevision);

  const beforeSwap = await page.evaluate(() => ({
    current: structuredClone(window.professionApp.build.rotation),
    reference: structuredClone(window.professionApp.rotationComparison.referenceRotation)
  }));
  await page.getByRole('button', { name: 'Swap', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.professionApp.simulationStatus)).toBe('idle');
  const afterSwap = await page.evaluate(() => ({
    current: window.professionApp.build.rotation,
    reference: window.professionApp.rotationComparison.referenceRotation
  }));
  expect(afterSwap.current).toEqual(beforeSwap.reference);
  expect(afterSwap.reference).toEqual(beforeSwap.current);

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    const pageWidth = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 5)
        .map((element) => ({
          className: element.className,
          id: element.id,
          right: element.getBoundingClientRect().right
        }))
    }));
    expect(pageWidth, JSON.stringify(pageWidth.overflow)).toMatchObject({
      clientWidth: pageWidth.scrollWidth
    });
    await expect(page.locator('#rotation-timeline')).toBeVisible();
    await expect(referenceTimeline).toBeVisible();
    const header = referenceSection.locator('.rotation-comparison-reference-header');
    await expect(header.locator('#rotation-comparison-summary')).toBeVisible();

    if (viewport.width > 900) {
      const summaryBox = await header.locator('#rotation-comparison-summary').boundingBox();
      const actionsBox = await header.locator('[data-comparison-reference-actions]').boundingBox();
      expect(Math.abs(summaryBox.y + summaryBox.height / 2 - actionsBox.y - actionsBox.height / 2)).toBeLessThan(2);
    }

    // Collapsing reclaims vertical space; mobile timelines may retain their minimum height when controls wrap.
    const palette = page.locator('#rotation-palette');
    const skills = page.locator('#rotation-comparison-skills');
    const toggle = skills.locator('summary');
    await expect(page.locator('.rotation-focus-indicator, [data-comparison-palette-toggle]')).toHaveCount(0);
    await expect(toggle).toBeInViewport();
    const expandedHeights = await Promise.all(
      [currentTimeline, referenceTimeline].map((view) => view.evaluate((el) => el.clientHeight))
    );
    const expandedCurrentBox = await currentTimeline.boundingBox();
    await toggle.click();
    await expect(skills).not.toHaveAttribute('open');
    await expect(palette).toBeHidden();
    const collapsedHeights = await Promise.all(
      [currentTimeline, referenceTimeline].map((view) => view.evaluate((el) => el.clientHeight))
    );
    collapsedHeights.forEach((height, index) => expect(height).toBeGreaterThanOrEqual(expandedHeights[index]));
    expect((await currentTimeline.boundingBox()).y).toBeLessThan(expandedCurrentBox.y);

    if (viewport.width > 900)
      expect(collapsedHeights[0] + collapsedHeights[1]).toBeGreaterThan(expandedHeights[0] + expandedHeights[1]);

    const referenceBox = await referenceTimeline.boundingBox();
    expect(referenceBox.y + referenceBox.height).toBeLessThanOrEqual(viewport.height);

    await page.evaluate(() => window.professionApp.adapter.renderRotationBuilder(window.professionApp));
    await expect(palette).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(skills).toHaveAttribute('open');
    await expect(palette).toBeVisible();
  }

  await page.locator('#rotation-comparison-skills > summary').click();
  await page.getByRole('button', { name: 'Exit compare' }).click();
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-comparison', '');
  await expect(page.locator('body')).toHaveAttribute('data-rotation-focus', '');
  await expect(page.locator('#rotation-palette')).toBeVisible();
  await expect(page.locator('#rotation-comparison-skills')).toHaveCount(0);

  await page.getByRole('button', { name: 'Compare' }).click();
  await page.getByRole('button', { name: 'Exit focus' }).click();
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-focus', '');
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-comparison', '');
});

test('rotation comparison optionally links combat time across unequal rotations', async ({ page }) => {
  await openSimulator(page);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation = [
      { type: 'wait', durationMs: 1000 },
      { type: 'combat-start' },
      { type: 'wait', durationMs: 1000 }
    ];
    app.changed(false);
  });
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.evaluate(() => window.professionApp.loadRotationReference(window.professionApp.build.rotation));
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();

  const current = page.locator('#rotation-timeline');
  const reference = page.locator('#rotation-reference-timeline');
  const linkScrolling = page.getByRole('checkbox', { name: 'Link scrolling by time' });
  await expect(linkScrolling).not.toBeChecked();
  // Retain the selected mode during ordinary view refreshes.
  await linkScrolling.check();
  await page.evaluate(() => window.professionApp.adapter.renderRotationBuilder(window.professionApp));
  await expect(linkScrolling).toBeChecked();
  await linkScrolling.uncheck();
  for (const timeline of [current, reference]) {
    await expect(timeline.locator('.rot-skill[data-idx="0"]')).toHaveAttribute('data-combat-time-ms', '-1000');
    await expect(timeline.locator('.rot-skill[data-idx="2"]')).toHaveAttribute('data-combat-time-ms', '0');
  }

  // Fixed rows isolate time alignment from wrapping: Reference advances twice as much combat time per row.
  for (const [timeline, count, interval] of [
    [current, 24, 1000],
    [reference, 32, 2000]
  ]) {
    await timeline.evaluate(
      (element, { count, interval }) => {
        element.style.cssText = 'height: 150px; min-height: 150px; flex: none; padding: 0; border: 0';
        element.replaceChildren();
        for (let index = 0; index < count; index++) {
          const skill = document.createElement('div');
          skill.className = 'rot-skill';
          skill.dataset.combatTimeMs = String(index * interval - 5000);
          skill.style.cssText = 'height: 100px; margin: 0; border: 0; transform: none';
          element.append(skill);
        }
      },
      { count, interval }
    );
  }

  const position = (timeline) => timeline.evaluate((element) => element.scrollTop);
  const scroll = (timeline, top) =>
    timeline.evaluate(async (element, top) => {
      element.scrollTop = top;
      // Flush both the original scroll and any mirrored event before asserting independence or feedback suppression.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, top);
  await scroll(current, 600);
  expect(await position(reference)).toBe(0);
  await scroll(reference, 800);
  expect(await position(current)).toBe(600);

  await linkScrolling.check();
  await scroll(current, 620);
  expect(await position(reference)).toBe(320);
  expect(await position(current)).toBe(620);
  await scroll(reference, 800);
  expect(await position(current)).toBe(1600);

  // Pre-combat times align too; reaching the shorter rotation's end must not pull the source backwards.
  await scroll(current, 200);
  expect(await position(reference)).toBe(100);
  await scroll(reference, 3000);
  expect(await position(current)).toBe(2250);
  expect(await position(reference)).toBe(3000);
  await scroll(reference, 0);
  expect(await position(current)).toBe(0);

  await linkScrolling.uncheck();
  await scroll(current, 600);
  expect(await position(reference)).toBe(0);
  await scroll(reference, 800);
  expect(await position(current)).toBe(600);

  await linkScrolling.check();
  await reference.evaluate((element) => element.replaceChildren());
  await scroll(current, 400);
  expect(await position(current)).toBe(400);
  expect(await position(reference)).toBe(0);

  const detachedReference = await reference.elementHandle();
  await page.getByRole('button', { name: 'Exit compare' }).click();
  await current.evaluate((element) => element.dispatchEvent(new Event('scroll')));
  expect(await detachedReference.evaluate((element) => element.scrollTop)).toBe(0);
  await detachedReference.dispose();
});
