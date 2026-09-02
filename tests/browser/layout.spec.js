import { expect, test } from '@playwright/test';

// Exercises computed layout in a real browser so CSS refactors are not coupled to stylesheet source text.
async function openSimulator(page, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('/mesmer.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.professionApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
}

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
