import { expect, test } from '@playwright/test';
import { openSimulator, openTemplates } from '#tests/helpers/browser-workspace.js';

// Clearing a restored rotation must update the editor in the click handler, before the first worker result.
test('clearing a freshly loaded rotation paints immediately and preserves undo', async ({ page }) => {
  await openSimulator(page);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);

  const cleared = await page.evaluate(() => {
    document.getElementById('btn-sim-clear').click();
    const app = window.professionApp;
    return {
      empty: document.getElementById('rotation-timeline').classList.contains('is-empty'),
      commands: app.build.rotation.length,
      pending: app.buildRevision !== app.resultRevision,
      undoEnabled: !document.getElementById('btn-sim-undo').disabled
    };
  });
  expect(cleared).toEqual({ empty: true, commands: 0, pending: true, undoEnabled: true });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await expect(page.locator('#rotation-timeline')).toHaveClass(/is-empty/);
  await page.locator('#btn-sim-undo').click();
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);
});

// A stalled template simulation must not hold up the new rotation after Clear.
test('clearing a loading template lets new skills simulate without its old worker', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.baseline = String(url).includes('/simulation/baseline/worker.');
      }

      postMessage(message) {
        if (this.baseline && !message.warmup && !window.heldBaselineJob) {
          window.heldBaselineJob = message;
          this.held = true;
          return;
        }

        super.postMessage(message);
      }

      terminate() {
        if (this.held) window.heldBaselineTerminated = true;

        super.terminate();
      }
    };
  });
  await openSimulator(page);
  await openTemplates(page);
  await page.locator('.template-load-btn').first().click();
  await page.waitForFunction(() => window.heldBaselineJob);
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toBeVisible();
  await expect(page.locator('#rotation-timeline')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#rotation-timeline .rotation-skeleton > div').first()).toHaveCSS(
    'animation-name',
    'analysis-skeleton-pulse'
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#rotation-timeline .rotation-skeleton > div').first()).toHaveCSS('animation-name', 'none');
  await page.locator('#btn-sim-clear').click();
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toHaveCount(0);
  // Removing the skeleton is immediate; the replacement worker must refresh the palette before input resumes.
  await expect(page.locator('#rotation-palette')).toHaveAttribute('data-palette-pending', 'false');
  await page.locator('.pal-skill[data-skill-id]:not(.pal-context-disabled):not(.pal-disabled)').first().click();
  await expect
    .poll(() => page.evaluate(() => window.professionApp.buildRevision === window.professionApp.resultRevision))
    .toBe(true);
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);
  expect(await page.evaluate(() => window.heldBaselineTerminated)).toBe(true);
});

// Ordinary skill edits retain the current timeline even when their background simulation is held open.
test('adding skills never shows the template skeleton', async ({ page }) => {
  // Hold transport at the browser boundary without reaching into the runner's private worker ownership.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.baseline = String(url).includes('/simulation/baseline/worker.');
      }
      postMessage(message) {
        if (this.baseline && window.holdBaselineMessages && !message.warmup) {
          window.heldBaselineJob = message;
          return;
        }

        super.postMessage(message);
      }
    };
  });
  await openSimulator(page);
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await page.evaluate(() => {
    window.holdBaselineMessages = true;
  });
  await page.locator('.pal-skill[data-skill="Bladecall"]').click();
  await page.waitForFunction(() => window.heldBaselineJob);
  await expect(page.locator('#rotation-timeline .rotation-skeleton')).toHaveCount(0);
  await expect(page.locator('#rotation-timeline .rot-skill[data-idx]')).toHaveCount(1);
});

// Cold baseline setup must reuse the preloaded engine and avoid the editor's dependency graph.
test('template baselines reuse the preloaded worker without importing editor views', async ({ page }) => {
  await openSimulator(page);
  const worker = page.workers().find((entry) => entry.url().includes('/simulation/baseline/worker.'));
  expect(worker).toBeDefined();
  await openTemplates(page);
  await page.locator('.template-load-btn').first().click();
  await page.waitForFunction(() => {
    const app = window.professionApp;
    return app.build.rotation.length > 0 && app.buildRevision === app.resultRevision;
  });
  expect(page.workers().find((entry) => entry.url().includes('/simulation/baseline/worker.'))).toBe(worker);
  const editorImports = await worker.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\/app\/(?:build|rotation|results)\//.test(url))
  );
  expect(editorImports).toEqual([]);
});

// Template placeholders retain the builder geometry and use native skill-row heights at each display size.
test('template skeleton preserves the populated builder dimensions', async ({ page }) => {
  await openSimulator(page);
  await openTemplates(page);
  await page.locator('.template-load-btn').first().click();
  await page.waitForFunction(() => {
    const app = window.professionApp;
    return app.build.rotation.length > 0 && app.buildRevision === app.resultRevision;
  });
  let releaseBuild;
  let buildReady;
  await page.route('**/data/gw2/builds/mesmer/b-*.json*', async (route) => {
    await buildReady;
    await route.continue();
  });
  for (const [width, height, focus, size] of [
    [1280, 900, false, 'normal'],
    [1280, 900, false, 'extra-large'],
    [600, 900, true, 'large']
  ]) {
    await page.setViewportSize({ width, height });
    // Persist size through the actual control so a later render cannot reset a DOM-only override.
    await page.getByRole('combobox', { name: 'Timeline size', exact: true }).selectOption(size);
    await page.evaluate(async (focus) => {
      document.body.toggleAttribute('data-rotation-focus', focus);
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, focus);
    const timeline = page.locator('#rotation-timeline');
    const before = await timeline.boundingBox();
    const rowBefore = await timeline.locator('.rot-row-line').first().boundingBox();
    buildReady = new Promise((resolve) => {
      releaseBuild = resolve;
    });
    const visibleDuringLoad = await page.evaluate(async () => {
      const { loadTemplateAction } = await import('/js/games/gw2/app/build/library/actions.ts');
      const app = window.professionApp;
      void loadTemplateAction(app, app.templatePresets[0], 'template', document.querySelector('.template-load-btn'));
      // Check the first paint without locator retries masking a visibility transition.
      return [...document.querySelectorAll('#rotation-timeline .rot-skill, #rotation-timeline .rot-skill span')]
        .filter((element) => getComputedStyle(element).visibility !== 'hidden')
        .map((element) => element.className);
    });
    expect(visibleDuringLoad).toEqual([]);
    const skeleton = timeline.locator('.rotation-skeleton');
    await expect(skeleton).toBeVisible();
    const during = await timeline.boundingBox();
    const dimensions = await timeline.evaluate((root) => {
      const bounds = root.querySelector('.rotation-skeleton').getBoundingClientRect();
      return {
        width: root.clientWidth,
        height: root.clientHeight,
        skeletonWidth: bounds.width,
        skeletonHeight: bounds.height
      };
    });
    expect(during.height).toBeCloseTo(before.height, 0);
    expect(dimensions.skeletonHeight).toBeCloseTo(dimensions.height, 0);
    expect(dimensions.skeletonWidth).toBeCloseTo(dimensions.width, 0);
    const bars = await skeleton
      .locator(':scope > div')
      .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    expect(bars.length).toBe(Math.ceil(dimensions.height / rowBefore.height));
    for (const height of bars) expect(height).toBeCloseTo(rowBefore.height, 0);
    await expect(timeline.locator('.rot-skill:visible')).toHaveCount(0);
    releaseBuild();
    await expect(skeleton).toHaveCount(0);
    await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  }
});
