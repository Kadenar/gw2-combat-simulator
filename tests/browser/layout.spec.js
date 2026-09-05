import { expect, test } from '@playwright/test';

// Exercises computed layout in a real browser so CSS refactors are not coupled to stylesheet source text.
async function openSimulator(page, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.professionApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
}

test('landing page exposes profession navigation and restores focus after its tutorial', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Guild Wars 2 Rotation Simulator' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick a profession to get started!' })).toBeVisible();
  await expect(page.locator('.profession-showcase')).toHaveCount(9);

  const trigger = page.getByRole('button', { name: 'How do I use this tool?' });

  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'How to use the simulator' });

  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close tutorial' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

// Native closest() matching must protect controls and dialog descendants for both rotation keyboard handlers.
test('shared hotkey exclusion protects editable controls and dialogs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const failures = await page.evaluate(async () => {
    const { shouldIgnoreHotkey } = await import('/js/ui/shared/dom.ts');
    const cases = [
      ['<input>', true],
      ['<textarea></textarea>', true],
      ['<select><option>Choice</option></select>', true],
      ['<div contenteditable="true"><span>Text</span></div>', true],
      ['<div role="dialog"><button>Action</button></div>', true],
      ['<dialog><button>Action</button></dialog>', true],
      ['<div contenteditable="false"><span>Text</span></div>', false],
      ['<button>Action</button>', false]
    ];
    const failures = cases.flatMap(([html, ignored]) => {
      const container = document.createElement('div');
      container.innerHTML = html;
      const targets = [...container.querySelectorAll('*')];
      return targets.some((target) => shouldIgnoreHotkey({ target }) !== ignored) ? [html] : [];
    });
    for (const target of [null, document, document.createTextNode('Text')]) {
      if (shouldIgnoreHotkey({ target })) failures.push(String(target));
    }

    return failures;
  });
  expect(failures).toEqual([]);
});

test('simulation config controls and result-dependent palette state work in the browser', async ({ page }) => {
  await openSimulator(page);

  const openConfig = page.getByRole('button', { name: 'Open simulation config' });

  await openConfig.click();
  const config = page.locator('#simulation-config-panel');

  await expect(config).toBeVisible();
  await expect(config.getByText('Timeline Display', { exact: true })).toBeVisible();
  await expect(config.getByLabel('Display idle time')).toBeVisible();
  await expect(config.getByLabel('Overlay sigils')).toBeVisible();
  await expect(config.getByLabel('Overlay relics')).toBeVisible();
  await expect(config.getByLabel('Overlay Sovereign of Light')).toHaveCount(0);

  await config.getByRole('button', { name: 'Close simulation config' }).click();
  await expect(config).toBeHidden();
  await expect(openConfig).toBeFocused();

  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);
  await expect(page.locator('#floating-dps')).toHaveAttribute('aria-label', /Current rotation DPS: /);
  await expect(page.locator('[data-role="current-rotation-dps"]')).toHaveCount(0);
});

// A palette drop and a timeline edit must share the authored wait duration through rerenders.
test('a palette wait drop opens its editor and the timeline can edit the inserted wait', async ({ page }) => {
  await openSimulator(page);
  const timeline = page.locator('#rotation-timeline');
  const wait = page.locator('.pal-skill[data-skill="__wait"]');
  // Exercise the DOM drag handlers independently of Chrome's mouse gesture recognition.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await wait.dispatchEvent('dragstart', { dataTransfer });
  await timeline.dispatchEvent('dragover', { dataTransfer });
  await timeline.dispatchEvent('drop', { dataTransfer });
  await wait.dispatchEvent('dragend', { dataTransfer });
  await dataTransfer.dispose();

  const addWait = page.getByRole('dialog', { name: 'Add wait' });
  await expect(addWait).toBeVisible();
  await addWait.getByLabel('Duration', { exact: true }).fill('333');
  await addWait.getByRole('button', { name: 'Apply' }).click();
  await expect(timeline.locator('.rot-wait-badge')).toContainText('333ms');
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  await timeline.locator('.rot-skill[data-idx="0"]').hover();
  await timeline.getByRole('button', { name: 'Edit Wait duration' }).click();
  const editWait = page.getByRole('dialog', { name: 'Edit wait' });
  await expect(editWait.getByLabel('Duration', { exact: true })).toHaveValue('333');
  await editWait.getByLabel('Duration', { exact: true }).fill('125');
  await editWait.getByRole('button', { name: 'Apply' }).click();
  await expect(timeline.locator('.rot-wait-badge')).toContainText('125ms');
});

test('timing skill selection submits the picker and details expand below DPS', async ({ page }) => {
  await openSimulator(page);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await expect(page.locator('#rotation-timeline')).not.toHaveClass(/is-empty/);

  const picker = page.locator('.timing-check-picker');
  await picker.locator(':scope > summary').click();
  const swapWeapons = picker.getByRole('button', { name: 'Swap Weapons' });
  const bladecall = picker.getByRole('button', { name: 'Bladecall' });
  const actionGroup = swapWeapons.locator('..');
  const weaponGroup = bladecall.locator('..');
  await expect(swapWeapons.locator('img')).toHaveAttribute('src', /Weapon_Swap_Button\.png/);
  await expect(actionGroup.locator('.timing-check-picker-group-label')).toHaveText('Actions');
  await expect(weaponGroup.locator('.timing-check-picker-group-label')).toHaveText('Weapon bar · Slot 2');
  const search = picker.getByRole('searchbox', { name: 'Search skills' });
  await search.pressSequentially('Bladecall');
  await expect(swapWeapons).toBeHidden();
  await expect(actionGroup).toBeHidden();
  await expect(bladecall).toBeVisible();
  await bladecall.click();

  await expect(picker).not.toHaveAttribute('open', '');
  await expect(page.locator('.timing-check-chip')).toContainText('Bladecall');
  expect(await page.evaluate(() => Object.hasOwn(window.professionApp.build, 'timingCheckSkillIds'))).toBe(false);
  const details = page.locator('.rotation-timing-details-wrap');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(page.locator('#rotation-dps-summary + #rotation-timing-details')).toBeAttached();
  await details.locator(':scope > summary').click();
  await expect(details).toHaveAttribute('open', '');
  const skillDetails = details.locator('.timing-skill-details');
  await expect(skillDetails).toHaveCount(1);
  await skillDetails.locator(':scope > summary').click();
  const widths = await skillDetails.evaluate((element) => ({
    body: element.querySelector('.timing-skill-detail-body').getBoundingClientRect().width,
    table: element.querySelector('table').getBoundingClientRect().width
  }));
  expect(widths.table).toBeLessThan(widths.body);
});

test('profession state duration checks use their own authoritative transitions', async ({ page }) => {
  for (const fixture of [
    { page: '/engineer.html', specialization: 'Holosmith', label: 'Time in Photon Forge' },
    { page: '/guardian.html', specialization: 'Luminary', label: 'Time in Radiant Forge' },
    { page: '/necromancer.html', specialization: 'Reaper', label: 'Time in Shroud' },
    { page: '/warrior.html', specialization: 'Bladesworn', label: 'Time in Gunsaber' }
  ]) {
    await page.goto(fixture.page, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.professionApp);
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await page
      .locator('.presets-group')
      .filter({ has: page.locator('.presets-group-label', { hasText: fixture.specialization }) })
      .locator('.template-load-btn')
      .first()
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          (specialization) =>
            window.professionApp.currentTemplate?.signature?.includes(specialization) === true &&
            window.professionApp.simulationStatus === 'idle',
          fixture.specialization
        )
      )
      .toBe(true);

    const picker = page.locator('.timing-check-picker');
    await picker.locator(':scope > summary').click();
    await picker.getByRole('button', { name: fixture.label }).click();
    const details = page.locator('.rotation-timing-details-wrap');
    await details.locator(':scope > summary').click();
    await expect(details.locator('.timing-skill-details > summary')).toContainText(/[1-9]\d* stays?/);
  }
});

test('hidden template states stay out of layout', async ({ page }) => {
  await openSimulator(page);

  const displays = await page.locator('.build-templates').evaluate((templates) => {
    const elements = ['presets-group', 'template-preset', 'template-filter-empty'].map((className) => {
      const element = document.createElement('div');
      element.className = className;
      element.hidden = true;
      templates.append(element);
      return element;
    });

    return elements.map((element) => getComputedStyle(element).display);
  });

  expect(displays).toEqual(['none', 'none', 'none']);
});

// Component styles must keep hidden controls out of layout and reserve a motion-safe loading chart.
test('relic comparison controls and loading layout survive a narrow host', async ({ page }) => {
  await openSimulator(page, { width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    const { mountRotationResults } = await import('/js/games/gw2/app/results/rotation-results.ts');
    const host = document.createElement('div');
    host.dataset.layoutFixture = 'relic-comparison';
    host.style.width = '350px';
    document.body.append(host);
    mountRotationResults(host, {
      relicComparisonAvailable: true,
      relicComparisonStale: true,
      relicComparisonTarget: 'Fireworks',
      relicComparisonTargets: ['Fireworks']
    });
  });
  const comparison = page.locator('[data-layout-fixture="relic-comparison"] .relic-cmp');
  await expect(comparison.locator('[data-role="relic-comparison-stacks-control"]')).toBeHidden();
  await expect(comparison.getByRole('button', { name: 'Running' })).toBeDisabled();
  const layout = await comparison.evaluate((element) => {
    const skeleton = element.querySelector('.relic-cmp-skeleton');
    const bounds = skeleton.getBoundingClientRect();
    return {
      fits: element.scrollWidth <= element.clientWidth,
      ratio: bounds.width / bounds.height,
      animation: getComputedStyle(skeleton).animationName
    };
  });
  expect(layout.fits).toBe(true);
  expect(layout.ratio).toBeCloseTo(640 / 300, 2);
  expect(layout.animation).toBe('none');
});

test('empty and authored rotations keep a usable timeline and an open event log is not clipped', async ({ page }) => {
  await openSimulator(page);

  await page.evaluate(() => {
    window.professionApp.build.rotation = [];
    window.professionApp.changed(false);
  });

  const timeline = page.locator('#rotation-timeline');
  await expect(timeline).toHaveClass(/is-empty/);
  const emptyHeight = await timeline.evaluate((element) => element.getBoundingClientRect().height);

  const castAdded = await page.evaluate(() => {
    const skill = [...document.querySelectorAll('.pal-skill')].find((element) => element.dataset.skill === 'Bladecall');
    skill?.click();
    return Boolean(skill);
  });

  expect(castAdded).toBe(true);
  await expect(timeline).not.toHaveClass(/is-empty/);
  const authoredHeight = await timeline.evaluate((element) => element.getBoundingClientRect().height);
  expect(emptyHeight).toBeGreaterThanOrEqual(280);
  expect(authoredHeight).toBeGreaterThanOrEqual(280);

  const eventLog = page.locator('.rotation-event-log .res-log-wrap');
  await expect(eventLog).toBeAttached();
  await eventLog.evaluate((element) => {
    element.open = true;
  });

  const panelLayout = await page.locator('.rotation-panel').evaluate((panel) => {
    const style = getComputedStyle(panel);
    return { maxHeight: style.maxHeight, overflow: style.overflow };
  });

  expect(panelLayout).toEqual({ maxHeight: 'none', overflow: 'visible' });
});

test('weapon-set labels stay centered in groups and visible while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/necromancer.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.necromancerApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);

  const renderCycles = (count) =>
    page.evaluate((cycleCount) => {
      const app = window.necromancerApp;
      const cycle = [
        'Feast of Corruption',
        'Harbinger Shroud',
        'Tainted Bolts',
        'Exit Harbinger Shroud',
        'Feast of Corruption'
      ];
      const names = Array.from({ length: cycleCount }, () => cycle).flat();
      const skills = names.map((name) => app.activeCatalog.skillsByName.get(name));
      if (skills.some((skill) => !skill)) return false;
      app.build.startingWeaponSet = 1;
      app.build.rotation = skills.map((skill) => ({ type: 'cast', skillId: skill.id }));
      app.changed(false);
      return true;
    }, count);

  expect(await renderCycles(1)).toBe(true);
  const timeline = page.locator('#rotation-timeline');
  const group = page.locator('#rotation-timeline > .rot-row');
  await expect(group).toHaveCount(1);
  const labelContent = group.locator(':scope > .rot-row-label > .rot-row-label-content');
  const label = labelContent.locator('.rot-row-label-text');
  await expect(label).toHaveText('W1');
  await expect(labelContent.locator('.rot-row-duration')).toHaveText(/\d+\.\d{3}s/);
  const labelLayout = await labelContent.evaluate((element) => {
    const weapon = element.querySelector('.rot-row-label-text');
    const duration = element.querySelector('.rot-row-duration');
    return {
      writingMode: getComputedStyle(weapon).writingMode,
      durationBelowWeapon: duration.getBoundingClientRect().top >= weapon.getBoundingClientRect().bottom
    };
  });
  expect(labelLayout).toEqual({ writingMode: 'horizontal-tb', durationBelowWeapon: true });
  await expect(group.locator('.rot-row-line')).toHaveCount(3);
  const centerOffset = await group.evaluate((element) => {
    const groupRect = element.getBoundingClientRect();
    const labelRect = element.querySelector('.rot-row-label-content').getBoundingClientRect();
    return Math.abs(labelRect.top + labelRect.height / 2 - (groupRect.top + groupRect.height / 2));
  });
  expect(centerOffset).toBeLessThan(1);

  expect(await renderCycles(12)).toBe(true);
  await expect(group.locator('.rot-row-line')).toHaveCount(25);
  expect(await group.locator('.rot-row-skills').evaluateAll((lines) => lines.every((line) => line.ondrop))).toBe(true);

  const heights = await group.evaluate((element) => ({
    label: element.querySelector('.rot-row-label').getBoundingClientRect().height,
    line: element.querySelector('.rot-row-line').getBoundingClientRect().height
  }));
  expect(heights.label).toBeGreaterThan(heights.line * 2);

  const labelIsVisible = () =>
    labelContent.evaluate((element) => {
      const labelRect = element.getBoundingClientRect();
      const timelineRect = element.closest('.rotation-timeline').getBoundingClientRect();
      return labelRect.top >= timelineRect.top && labelRect.bottom <= timelineRect.bottom;
    });
  expect(await labelIsVisible()).toBe(true);
  await timeline.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await labelIsVisible()).toBe(true);
});

test('loaded manifest rows show each weapon stay instead of repeated set totals', async ({ page }) => {
  await page.goto('/guardian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.guardianApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.locator('.template-load-btn').first().click();
  await expect
    .poll(() =>
      page.evaluate(() => window.guardianApp.currentTemplate !== null && window.guardianApp.simulationStatus === 'idle')
    )
    .toBe(true);

  const durations = await page.evaluate(() => {
    const app = window.guardianApp;
    const timelineEnd = app.results.duration * 1000;
    const timelineStart = Math.min(0, ...app.results.steps.filter((step) => !step.invalid).map((step) => step.start));
    const swapId = app.activeCatalog.skillsByName.get('Swap Weapons').id;
    const swapEnds = app.results.steps
      .filter((step) => !step.invalid && step.skillId === swapId)
      .map((step) => step.end)
      .sort((left, right) => left - right);
    let set = app.build.startingWeaponSet;
    let start = timelineStart;
    const expected = [...swapEnds, timelineEnd].map((end) => {
      const stay = { weapon: `W${set}`, duration: `${((end - start) / 1000).toFixed(3)}s` };
      set = set === 1 ? 2 : 1;
      start = end;
      return stay;
    });
    const actual = [...document.querySelectorAll('#rotation-timeline > .rot-row')].map((row) => ({
      weapon: row.querySelector('.rot-row-label-text').textContent,
      duration: row.querySelector('.rot-row-duration').textContent
    }));
    return { actual, expected };
  });

  expect(durations.actual).toEqual(durations.expected);
});

test('mobile focus mode keeps one viewport-wide scrolling workspace', async ({ page }) => {
  await openSimulator(page, { width: 600, height: 900 });
  await page.evaluate(() => {
    document.body.dataset.rotationFocus = '';
  });

  const layout = await page.locator('.rotation-section').evaluate((section) => {
    const palette = section.querySelector('.rotation-palette');
    const timeline = section.querySelector('.rotation-timeline');
    const results = section.querySelector('.rotation-results');
    const controls = section.querySelector('.rotation-mid');
    const sectionStyle = getComputedStyle(section);

    return {
      fitsViewport: section.scrollWidth <= section.clientWidth,
      overflowX: sectionStyle.overflowX,
      overflowY: sectionStyle.overflowY,
      paletteScrollable: palette.scrollHeight > palette.clientHeight,
      timelineScrollable: timeline.scrollHeight > timeline.clientHeight,
      resultsDisplay: getComputedStyle(results).display,
      controlRows: getComputedStyle(controls).gridTemplateAreas
    };
  });

  expect(layout).toEqual({
    fitsViewport: true,
    overflowX: 'hidden',
    overflowY: 'auto',
    paletteScrollable: false,
    timelineScrollable: false,
    resultsDisplay: 'none',
    controlRows: '"label size" "start start" "buttons buttons"'
  });
});

test('rotation comparison keeps editable and read-only timelines stacked without page overflow', async ({ page }) => {
  await openSimulator(page);
  // Start from a manifest build so the reference picker has one compatible skill loadout.
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
    const bladecall = app.skillByName.get('Bladecall');
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

  await page.getByRole('button', { name: 'Compare' }).click();
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
  const existingRotations = loadDialog.getByLabel('Existing rotation');
  await expect.poll(() => existingRotations.locator('option').count()).toBeGreaterThan(1);
  await existingRotations.selectOption({ index: 1 });
  await loadDialog.getByRole('button', { name: 'Load selected' }).click();
  await expect(loadDialog.getByRole('button', { name: 'Use as reference' })).toBeEnabled();
  await loadDialog.getByRole('button', { name: 'Use as reference' }).click();
  await expect(page.locator('[data-comparison-status]')).toHaveText('Fresh');
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
    app.build.rotation.push({ type: 'cast', skillId: app.skillByName.get('Mirror Blade').id });
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
  await expect(page.locator('[data-comparison-status]')).toHaveText('Fresh');

  const finalValues = await page
    .locator('#rotation-comparison-summary')
    .evaluate((summary) => [
      summary.querySelector('[data-comparison-reference-dps]').textContent,
      summary.querySelector('[data-comparison-current-dps]').textContent
    ]);
  // Mouse and keyboard cursor changes update both comparisons without editing or resimulating the rotation.
  const comparisonLabel = page.locator('[data-comparison-metric-label]');
  const currentTimeline = page.locator('#rotation-timeline');
  const buildRevision = await page.evaluate(() => window.professionApp.buildRevision);
  await expect(page.locator('#rotation-comparison-summary input[type="range"]')).toHaveCount(0);
  await currentTimeline.locator('[data-insertion-index="0"]').click();
  await expect(comparisonLabel).toHaveText('Average DPS through 0.00s');
  await expect(page.locator('[data-comparison-reference-dps]')).toHaveText('0');
  await expect(page.locator('[data-comparison-current-dps]')).toHaveText('0');

  await page.keyboard.press('ArrowRight');
  await expect(currentTimeline.locator('.rot-insertion-gap.active')).toHaveAttribute('data-insertion-index', '1');
  const checkpointLabel = await page.evaluate(async () => {
    const { paletteEndState } = await import('/js/games/gw2/app/rotation/shared/context.ts');
    const app = window.professionApp;
    const elapsedMs = paletteEndState(app).time - app.results.dpsStartTime * 1000;
    return `Average DPS through ${(elapsedMs / 1000).toFixed(2)}s`;
  });
  await expect(comparisonLabel).toHaveText(checkpointLabel);
  await expect(currentTimeline.locator('.rot-preview-active').first()).toBeVisible();
  await expect(referenceTimeline.locator('.rot-preview-active').first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(comparisonLabel).toHaveText('Final DPS');
  await expect(page.locator('[data-comparison-reference-dps]')).toHaveText(finalValues[0]);
  await expect(page.locator('[data-comparison-current-dps]')).toHaveText(finalValues[1]);
  await expect(page.locator('.rot-preview-active')).toHaveCount(0);
  await currentTimeline.locator('[data-insertion-index="0"]').click();
  await currentTimeline.locator('.rot-insertion-gap').last().click();
  await expect(comparisonLabel).toHaveText('Final DPS');
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
  }

  await page.getByRole('button', { name: 'Exit comparison' }).click();
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-comparison', '');
  await expect(page.locator('body')).toHaveAttribute('data-rotation-focus', '');

  await page.getByRole('button', { name: 'Compare' }).click();
  await page.getByRole('button', { name: 'Exit focus' }).click();
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-focus', '');
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-comparison', '');
});

test('damage and condition breakdowns split only when their container is wide', async ({ page }) => {
  await openSimulator(page, { width: 1400, height: 900 });
  const fixture = page.locator('[data-layout-fixture="result-breakdown"]');

  await page.evaluate(() => {
    const section = document.createElement('section');
    section.className = 'res-breakdown-section';
    section.dataset.layoutFixture = 'result-breakdown';
    section.style.width = '1200px';
    section.innerHTML = `<div class="res-breakdown">
      <div class="res-breakdown-part res-damage-breakdown">
        <div class="res-section-title">Damage Breakdown</div>
        <div class="res-hdr">
          <span>Skill</span><span>Strike</span><span>Condition</span><span>Total</span><span>DPS</span>
          <span>Avg/Cast</span><span>DCT</span><span>Casts</span><span>Hits</span><span>Exp. Crit %</span>
        </div>
      </div>
      <div class="res-breakdown-part res-condition-breakdown">Conditions</div>
    </div>`;
    document.body.append(section);
  });

  const positions = () =>
    fixture.locator('.res-breakdown-part').evaluateAll((parts) =>
      parts.map((part) => {
        const rect = part.getBoundingClientRect();
        return { x: rect.x, y: rect.y, bottom: rect.bottom };
      })
    );

  const [wideDamage, wideConditions] = await positions();
  expect(wideConditions.x).toBeGreaterThan(wideDamage.x);
  expect(wideConditions.y).toBe(wideDamage.y);
  expect(
    await fixture.locator('.res-damage-breakdown').evaluate((damage) => {
      const style = getComputedStyle(damage);
      return { overflowX: style.overflowX, paddingRight: style.paddingRight };
    })
  ).toEqual({ overflowX: 'clip', paddingRight: '12px' });
  expect(
    await fixture.locator('.res-hdr').evaluate((header) => {
      const damage = header.closest('.res-damage-breakdown');
      return header.scrollWidth <= damage.clientWidth;
    })
  ).toBe(true);

  await fixture.evaluate((section) => {
    section.style.width = '900px';
  });
  const [narrowDamage, narrowConditions] = await positions();
  expect(narrowConditions.x).toBe(narrowDamage.x);
  expect(narrowConditions.y).toBeGreaterThanOrEqual(narrowDamage.bottom);
});
