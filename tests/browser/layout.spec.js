import { expect, test } from '@playwright/test';

import { openSimulator } from '#tests/helpers/browser-workspace.js';

test('empty and authored rotations keep a usable timeline and an open event log is not clipped', async ({ page }) => {
  await openSimulator(page);

  await page.evaluate(() => {
    window.professionApp.build.rotation = [];
    window.professionApp.changed(false);
  });

  const timeline = page.locator('#rotation-timeline');
  await expect(timeline).toHaveClass(/is-empty/);
  const emptyHeight = await timeline.evaluate((element) => element.getBoundingClientRect().height);

  // An empty timeline can paint before its palette is ready to accept the next authored skill.
  await expect(page.locator('#rotation-palette')).toHaveAttribute('data-palette-pending', 'false');
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
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
      const skills = names.map((name) => app.activeCatalog.skills.find((candidate) => candidate.name === name));

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
    controlRows: '"label settings" "buttons buttons"'
  });
});

test('damage and condition breakdowns split only when their container is wide', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(() => {
    document.body.innerHTML = '<div class="build-templates"></div>';
  });
  const fixture = page.locator('[data-layout-fixture="result-breakdown"]');

  await page.evaluate(async () => {
    const { SKILL_COLS } = await import('/js/games/gw2/app/results/breakdown/model.ts');
    const { resultColumnHeadingHtml } = await import('/js/games/gw2/app/results/breakdown/heading.ts');
    const { bindDamageBreakdownLayout } = await import('/js/games/gw2/app/results/breakdown/layout.ts');
    const section = document.createElement('section');
    section.className = 'res-breakdown-section';
    section.dataset.layoutFixture = 'result-breakdown';
    // A wide host places the real metric headings beside conditions; the narrow host stacks them.
    section.style.width = '1560px';
    section.innerHTML = `<div class="res-breakdown">
      <div class="res-breakdown-part res-damage-breakdown">
        <div class="res-section-title">Damage Breakdown</div>
        <div class="res-skill-scroll"><div data-role="skill-breakdown"><div class="res-hdr">
          ${SKILL_COLS.map((column) => resultColumnHeadingHtml(column, { sortable: true })).join('')}
        </div></div></div>
      </div>
      <div class="res-breakdown-part res-condition-breakdown">Conditions</div>
    </div>`;
    document.body.append(section);
    bindDamageBreakdownLayout(section);
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
  await expect(fixture.locator('.res-condition-breakdown')).toHaveCSS('border-left-width', '1px');
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
  await expect(fixture.locator('.res-damage-breakdown')).toHaveAttribute('data-compact', 'true');
  expect(
    await fixture.locator('.res-hdr').evaluate((header) => getComputedStyle(header).gridTemplateColumns.split(' ')[0])
  ).toBe('148px');
  await expect(fixture.locator('.res-condition-breakdown')).toHaveCSS('border-left-width', '0px');
});
