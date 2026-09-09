import { expect, test } from '@playwright/test';

// Exercises computed layout in a real browser so CSS refactors are not coupled to stylesheet source text.
async function openSimulator(page, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.professionApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
}

// The real palette must show projected endurance under Mirage Dodge without exposing an ammo counter.
test('Mirage dodge displays its continuously regenerated endurance', async ({ page }) => {
  await openSimulator(page);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await (await fetch('/data/gw2/builds/mesmer/b-power-mirage-spear-greatsword.json')).json();
    app.build = app.adapter.toApplicationBuild({
      ...saved,
      rotation: [
        { type: 'cast', skillId: -1 },
        { type: 'cast', skillId: -1 },
        { type: 'wait', durationMs: 1000 }
      ]
    });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const dodge = page.locator('.pal-skill[data-skill="Dodge / Mirage Cloak"]');
  await expect(dodge.locator('.pal-skill-resource')).toHaveAttribute('data-resource-id', 'endurance');
  await expect(dodge.locator('.pal-skill-resource')).toHaveAttribute('aria-valuenow', '7.5');
  await expect(dodge.locator('.pal-ammo-pip')).toHaveCount(0);
  await expect(dodge).not.toHaveAttribute('title', /ammo|Count recharge/);
});

// Injected dialogs and numeric controls must resolve the shared theme instead of falling back to transparent surfaces.
test('import and hotkey controls use the shared surface and numeric font', async ({ page }) => {
  await openSimulator(page);
  await page.locator('.rotation-hotkey-button').click();
  const surface = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--bg-panel-alt)';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });

  for (const selector of ['.rotation-import-report input', '.rotation-hotkey-field input']) {
    await expect(page.locator(selector).first()).toHaveCSS('background-color', surface);
  }

  await expect(page.locator('#target-armor')).toHaveCSS('font-family', /Consolas/);
});

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

// Embedded settings must trap focus, preserve edits, and remain usable inside a short, narrow frame.
test('embedded simulation config uses a dismissible native modal', async ({ page }) => {
  await page.goto('/');
  await page.setContent(
    '<iframe title="Simulator" src="/mesmer.html?embed=1" style="width: 800px; height: 600px"></iframe>'
  );
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#loading-overlay')).toHaveClass(/hidden/);
  const trigger = frame.getByRole('button', { name: 'Open simulation config' });
  const config = frame.getByRole('dialog', { name: 'Simulation config' });
  const close = config.getByRole('button', { name: 'Close simulation config' });

  await trigger.click();
  await expect(config).toBeVisible();
  expect(await config.evaluate((dialog) => dialog.matches(':modal'))).toBe(true);
  await expect(close).toBeFocused();
  await frame.locator('.simulation-config-open-button').evaluate((button) => button.focus());
  await expect(close).toBeFocused();
  await close.press('Tab');
  expect(await config.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await config.getByLabel('Display idle time').check();
  await page.keyboard.press('Escape');
  await expect(config).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.locator('iframe').evaluate((iframe) => {
    iframe.style.width = '320px';
    iframe.style.height = '400px';
  });
  await trigger.click();
  await expect(config.getByLabel('Display idle time')).toBeChecked();
  const bounds = await config.evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    const controls = dialog.querySelector('#perma-boons');
    return {
      fits: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      centered: Math.abs(rect.left + rect.width / 2 - innerWidth / 2) < 1,
      scrolls: controls.scrollHeight > controls.clientHeight
    };
  });
  expect(bounds).toEqual({ fits: true, centered: true, scrolls: true });
  await config.getByLabel('Overlay relics').check();
  await expect(close).toBeInViewport();
  await close.click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  const iframeBox = await page.locator('iframe').boundingBox();
  await page.mouse.click(iframeBox.x + 4, iframeBox.y + 4);
  await expect(config).toBeHidden();
  await expect(trigger).toBeFocused();
});

// The settings drawer stays pinned outside editor containers and retains both viewport margins.
test('simulation config stays inside the viewport after scrolling and hides in Analysis', async ({ page }) => {
  await openSimulator(page);
  const config = page.locator('body > #simulation-config-panel');

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Open simulation config' }).click();
    await expect(config).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const margin = width <= 700 ? 6 : 12;
    await expect
      .poll(async () => {
        const box = await config.boundingBox();
        return (
          box && {
            top: Math.round(box.y),
            right: Math.round(width - box.x - box.width),
            bottom: Math.round(900 - box.y - box.height),
            width: Math.round(box.width)
          }
        );
      })
      .toEqual({ top: margin, right: margin, bottom: margin, width: Math.min(360, width - 2 * margin) });
    await page.keyboard.press('Escape');
    await expect(config).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open simulation config' })).toBeFocused();
  }

  await page.getByRole('button', { name: 'Open simulation config' }).click();
  // Isolate Analysis visibility from navigation's separate close-on-view-change behavior.
  await page.evaluate(() => {
    document.body.dataset.simulatorView = 'analysis';
  });
  await expect(config).toBeHidden();
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
    const { mountRelicComparison } =
      await import('/js/games/gw2/app/simulation/relic-comparison/relic-comparison-panel.ts');
    const host = document.createElement('div');
    host.dataset.layoutFixture = 'relic-comparison';
    host.style.width = '350px';
    document.body.append(host);
    mountRelicComparison(host, {
      relicComparisonAvailable: true,
      relicComparisonStale: true,
      relicComparisonTarget: 'Fireworks',
      relicComparisonTargets: ['Fireworks', 'Thorns', 'Nourys']
    });
  });
  const comparison = page.locator('[data-layout-fixture="relic-comparison"] .relic-cmp');
  const relicSelect = comparison.getByRole('combobox', { name: 'Comparison relic' });
  await expect(relicSelect).toHaveCSS('text-align', 'left');
  await expect(relicSelect).toHaveCSS('font-size', '11px');
  await expect(relicSelect.locator('optgroup')).toHaveCount(3);
  await expect(relicSelect.locator('optgroup').first()).toHaveCSS('font-weight', '700');
  await expect(relicSelect.locator('option').first()).toHaveCSS('font-weight', '400');
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

    // Collapsing the palette gives both views more room and survives normal editor refreshes.
    const palette = page.locator('#rotation-palette');
    const skills = page.locator('#rotation-comparison-skills');
    const toggle = skills.locator('summary');
    await expect(page.locator('.rotation-focus-indicator, [data-comparison-palette-toggle]')).toHaveCount(0);
    await expect(toggle).toBeInViewport();
    const expandedHeights = await Promise.all(
      [currentTimeline, referenceTimeline].map((view) => view.evaluate((el) => el.clientHeight))
    );
    await toggle.click();
    await expect(skills).not.toHaveAttribute('open');
    await expect(palette).toBeHidden();
    const collapsedHeights = await Promise.all(
      [currentTimeline, referenceTimeline].map((view) => view.evaluate((el) => el.clientHeight))
    );
    collapsedHeights.forEach((height, index) => expect(height).toBeGreaterThanOrEqual(expandedHeights[index]));
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
  await page.getByRole('button', { name: 'Exit comparison' }).click();
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-comparison', '');
  await expect(page.locator('body')).toHaveAttribute('data-rotation-focus', '');
  await expect(page.locator('#rotation-palette')).toBeVisible();
  await expect(page.locator('#rotation-comparison-skills')).toHaveCount(0);

  await page.getByRole('button', { name: 'Compare' }).click();
  await page.getByRole('button', { name: 'Exit focus' }).click();
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-focus', '');
  await expect(page.locator('body')).not.toHaveAttribute('data-rotation-comparison', '');
});

test('rotation comparison links scrolling in both directions across unequal view lengths', async ({ page }) => {
  await openSimulator(page);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation = [{ type: 'wait', durationMs: 1000 }];
    app.changed(false);
  });
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.evaluate(() => window.professionApp.loadRotationReference(window.professionApp.build.rotation));
  await expect(page.locator('[data-comparison-swap]')).toBeEnabled();

  const current = page.locator('#rotation-timeline');
  const reference = page.locator('#rotation-reference-timeline');
  // Fixed content isolates native scrolling, including unequal ranges and a reference that cannot scroll.
  for (const [timeline, height] of [
    [current, 1200],
    [reference, 1900]
  ]) {
    await timeline.evaluate((element, height) => {
      element.style.cssText = 'height: 150px; min-height: 150px; flex: none';
      const content = document.createElement('div');
      content.style.height = `${height}px`;
      element.replaceChildren(content);
    }, height);
  }

  const progress = (timeline) =>
    timeline.evaluate((element) => element.scrollTop / (element.scrollHeight - element.clientHeight));
  await current.hover();
  await page.mouse.wheel(0, 315);
  await expect.poll(() => progress(current)).toBeGreaterThan(0.2);
  await expect.poll(async () => Math.abs((await progress(current)) - (await progress(reference)))).toBeLessThan(0.002);

  await reference.hover();
  await page.mouse.wheel(0, 350);
  await expect.poll(() => progress(reference)).toBeGreaterThan(0.4);
  await expect.poll(async () => Math.abs((await progress(current)) - (await progress(reference)))).toBeLessThan(0.002);

  await current.evaluate((element) => (element.scrollTop = element.scrollHeight));
  await expect.poll(() => progress(reference)).toBe(1);
  await reference.evaluate((element) => (element.scrollTop = 0));
  await expect.poll(() => progress(current)).toBe(0);

  await reference.evaluate((element) => (element.firstElementChild.style.height = '20px'));
  await current.evaluate((element) => (element.scrollTop = 315));
  // Wait through queued scroll events so a non-scrolling peer cannot bounce Current back to the top.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await current.evaluate((element) => element.scrollTop)).toBe(315);

  const detachedReference = await reference.elementHandle();
  await page.getByRole('button', { name: 'Exit comparison' }).click();
  await current.evaluate((element) => element.dispatchEvent(new Event('scroll')));
  expect(await detachedReference.evaluate((element) => element.scrollTop)).toBe(0);
  await detachedReference.dispose();
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
