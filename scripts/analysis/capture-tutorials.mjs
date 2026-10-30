// Record the current Golem workflows with captions, then encode the reviewed frames as tutorial GIFs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

/* global window, document */

// Capture real UI actions with readable pauses; keep frames in scratch so the GIFs can be reviewed before shipping.
const baseURL = process.env.TUTORIAL_URL || 'http://127.0.0.1:4173';
const output = '.scratch/tutorial-capture';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const recordings = [];
let page;
let frames;
let title;
let caption;
let pointer = { x: 1200, y: 60 };

async function ready() {
  await page.waitForFunction(() => {
    const app = window.professionApp;
    return app && app.buildRevision === app.resultRevision && app.simulationStatus === 'idle';
  });
  await page.locator('#loading-overlay').waitFor({ state: 'hidden' });
}

async function begin(name, label, landing = false) {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(60_000);
  frames = [];
  title = label;
  caption = '';
  recordings.push({ name, frames });
  await page.goto(`${baseURL}/${landing ? '' : 'mesmer.html'}`, { waitUntil: 'networkidle' });
  // Reserve the caption banner's height below the page so sections at the very bottom can scroll clear of it.
  await page.addStyleTag({ content: 'body { padding-bottom: 100px !important; }' });

  if (!landing) await ready();

  console.log(`Recording ${label}`);
}

async function frame(duration = 2200) {
  // Keep annotations above native dialogs and menus so their top layers cannot cover the instructions.
  await page.evaluate(
    ({ title, caption, pointer }) => {
      document.getElementById('capture-annotation')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'capture-annotation';
      overlay.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Arial,sans-serif';
      const banner = document.createElement('div');
      banner.style.cssText =
        'position:absolute;bottom:0;left:0;right:0;height:90px;box-sizing:border-box;padding:14px 28px;background:#10131ff5;border-top:3px solid #bd95ef;color:#fff;line-height:1.35';
      const heading = document.createElement('div');
      heading.style.cssText = 'color:#c9a8ff;font-size:15px;font-weight:700;letter-spacing:1px;margin-bottom:7px';
      heading.textContent = title.toUpperCase();
      const instruction = document.createElement('div');
      instruction.style.cssText = 'font-size:22px;font-weight:600';
      instruction.textContent = caption;
      banner.append(heading, instruction);
      const cursor = document.createElement('div');
      cursor.style.cssText = `position:absolute;left:${pointer.x - 11}px;top:${pointer.y - 11}px;width:22px;height:22px;border:3px solid #ffdf7d;border-radius:50%;background:#ffdf7d33;box-shadow:0 0 0 2px #111`;
      overlay.append(banner, cursor);
      (document.querySelector('dialog[open], :popover-open') || document.body).append(overlay);
    },
    { title, caption, pointer }
  );
  const path = `${output}/${recordings.at(-1).name}-${String(frames.length).padStart(3, '0')}.png`;
  await page.screenshot({ path });
  frames.push({ path, duration });
}

async function show(text, locator, duration = 2600) {
  caption = text;

  // The simulator header stays pinned to the top, so page content must land below it; header and dialog targets sit above it.
  if (locator)
    await locator.evaluate((el) => {
      const header = document.querySelector('#app > header');
      const covered =
        header && !header.contains(el) && !el.closest('dialog') ? header.getBoundingClientRect().height : 0;
      const tall = el.getBoundingClientRect().height > 650;

      // Top-aligned tall sections reserve the header height; centered targets already clear it.
      if (tall) el.style.scrollMarginTop = `${covered + 8}px`;

      el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'instant' });
    });

  await page.waitForTimeout(350);

  if (locator) {
    // Scrolling compacts the header; measure its current edge and leave room above centered charts.
    const headerBottom = await locator.evaluate((el) => {
      const header = document.querySelector('#app > header');

      if (!header || header.contains(el) || el.closest('dialog, :popover-open')) return 0;

      const bottom = Math.max(0, header.getBoundingClientRect().bottom);
      const top = el.getBoundingClientRect().top;

      if (top < bottom + 8) window.scrollBy(0, top - bottom - 8);

      return bottom;
    });
    await page.waitForTimeout(150);
    const box = await locator.boundingBox();
    assert.ok(
      box && box.y >= headerBottom - 1 && box.y + Math.min(box.height, 40) < 805,
      `Header or caption covers ${text}: ${JSON.stringify(box)}`
    );
    const chart = await locator.evaluate((el) => el.matches('canvas, svg'));
    pointer = {
      x: box.x + (chart ? box.width / 2 : Math.min(box.width / 2, 160)),
      y: box.y + (chart ? box.height / 2 : Math.min(box.height / 2, 24))
    };
    await page.mouse.move(pointer.x, pointer.y);
    await page.waitForTimeout(150);
  }

  await frame(duration);
}

async function click(locator, text) {
  await show(text, locator, 1600);
  await locator.click();
  await page.waitForTimeout(350);
  await frame(1800);
}

async function loadTemplate(record = false) {
  if (record) {
    await click(page.locator('.build-tab-new'), '2. Click + New to start a build.');
    await click(
      page.getByRole('button', { name: /Browse templates/ }),
      '3. Browse templates for ready-made builds and rotations.'
    );
    await click(
      page.locator('.template-load-btn').first(),
      '4. Choose a template; its gear, traits and rotation load together.'
    );
  } else {
    await page.locator('.build-tab-new').click();
    await page.getByRole('button', { name: /Browse templates/ }).click();
    await page.locator('.template-load-btn').first().click();
  }

  await ready();
  assert.ok(await page.locator('#rotation-timeline .rot-skill').count(), 'Template must produce a rotation');
}

async function tab(name) {
  const link = page.getByRole('link', { name, exact: true });
  await link.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await link.click();
  await page.waitForTimeout(600);
}

try {
  await begin('usage', 'Quick start', true);
  await click(
    page.locator('.profession-grid .profession-showcase-link[href*="mesmer.html"]'),
    '1. Pick a profession. This walkthrough uses Mesmer.'
  );
  await ready();
  await loadTemplate(true);
  await show('5. Review the loaded skills, traits and gear in Golem.', page.locator('#traits-panel'));
  await show('6. Scroll down to inspect the rotation and its live DPS.', page.locator('.rotation-section'));
  await tab('Golem Analysis');
  await show(
    '7. Open Golem Analysis to see DPS, damage sources and conditions.',
    page.locator('#analysis-dps-summary'),
    4000
  );
  await page.close();

  await begin('rotation-builder', 'Gear, traits & rotation builder');
  await show('1. Start in Golem to edit the build and its rotation.', page.locator('#traits-panel'));
  const gear = page.locator('.gear-select-display').filter({ has: page.locator('.gear-prefix[data-slot="Helm"]') });
  await click(gear.locator('.gear-select-trigger'), '2. Click a gear slot to choose its stat prefix.');
  await click(
    gear.getByRole('option').filter({ hasText: "Assassin's" }).first(),
    '3. Select a prefix; your character attributes update.'
  );
  await ready();
  await click(
    page.locator('.spec-trait-major.dim').first(),
    '4. Click a major trait to change the selected trait in that tier.'
  );
  await ready();
  await click(
    page.locator('#skill-bar [data-key="Utility1"] .sbar-icon'),
    '5. Click a skill above Traits to choose an equipped utility.'
  );
  await click(
    page.locator('.sbar-dropdown.open button[aria-pressed="false"]:not(:disabled)').first(),
    '6. Select a replacement skill for the build.'
  );
  await ready();
  await show('7. Scroll to Rotation Builder; click palette skills to queue casts.', page.locator('.rotation-section'));
  for (const skill of ['Bladecall', 'Unstable Bladestorm', 'Flying Cutter']) {
    await click(
      page.locator(`.pal-skill[data-skill="${skill}"]`).first(),
      `8. Queue ${skill}; the timeline and DPS recalculate.`
    );
    await ready();
  }

  await click(page.locator('#btn-sim-undo'), '9. Undo removes the last edit.');
  await ready();
  await click(page.locator('#btn-sim-redo'), '10. Redo restores it.');
  await ready();
  await show('11. The timeline shows the queued casts and their timing.', page.locator('#rotation-timeline'), 3500);
  // Save Rotation names the file in an export dialog first; the download starts only when Export is submitted.
  await click(page.locator('#btn-export-rotation'), '12. Save Rotation opens a dialog to name the JSON file.');
  const download = page.waitForEvent('download');
  await click(
    page.locator('.file-export-dialog').getByRole('button', { name: 'Export', exact: true }),
    '13. Click Export to download the rotation sequence.'
  );
  await (await download).saveAs(`${output}/example-rotation.json`);
  await click(page.locator('#btn-import-rotation'), '14. Load Rotation opens the file and combat-log import dialog.');
  await show(
    '15. Paste a dps.report or gw2wingman link to preview an import.',
    page.locator('[data-rotation-import-report-input]'),
    3500
  );
  await click(
    page.getByRole('tab', { name: 'Upload file', exact: true }),
    '16. Choose Upload file for saved JSON or an EVTC log.'
  );
  await show(
    '17. Drop a file here, then review the import before applying it.',
    page.locator('[data-rotation-import-drop]'),
    3500
  );
  await page.close();

  await begin('analysis', 'Analysis tab');
  await loadTemplate();
  await click(
    page.getByRole('link', { name: 'Golem Analysis', exact: true }),
    '1. Load a rotation, then open Golem Analysis.'
  );
  await show('2. Read duration, idle time, player damage and baseline DPS.', page.locator('#analysis-dps-summary'));
  await show(
    '3. Compare damage, DPS, average per cast, casts and hits.',
    page.locator('[data-role="skill-header"]'),
    3500
  );
  await click(
    page.locator('[data-role="skill-rows"] .res-row-selectable').first(),
    '4. Click a damage source to inspect its individual hits.'
  );
  await show(
    '5. Hover the DPS graph to inspect damage at a point in time.',
    page.locator('[data-role="dps-canvas"]'),
    3500
  );
  await click(
    page.getByRole('button', { name: '100-80%', exact: true }),
    '6. Use Chart range to focus on a target-health phase.'
  );
  await click(
    page.getByRole('button', { name: 'Full Fight', exact: true }),
    '7. Return to Full Fight for the complete timeline.'
  );
  await show(
    '8. Toggle individual effects in Boons & Buffs Over Time.',
    page.locator('[data-role="chart-toggles"]').first()
  );
  await click(
    page.locator('[data-effect-type="boon"] [data-toggle-action="none"]'),
    '9. Hide a group to make other effects easier to read.'
  );
  await click(
    page.locator('[data-effect-type="boon"] input').first(),
    '10. Enable an individual effect, then hover its graph.'
  );
  await show(
    '11. Read effect stacks and uptime along the rotation.',
    page.locator('[data-role="effects-canvas"]'),
    3500
  );
  await show(
    '12. Inspect damaging conditions in their separate timeline.',
    page.locator('[data-role="conditions-canvas"]'),
    3500
  );
  await expect(page.locator('.contrib-row').first()).toBeVisible({ timeout: 60_000 });
  await show(
    '13. Modifier Contributions estimates DPS gained from each modifier.',
    page.locator('.res-contributions h4'),
    4000
  );
  await page.close();

  await begin('gear-optimizer', 'Gear optimizer & relic comparison');
  await loadTemplate();
  await click(
    page.getByRole('link', { name: 'Gear Optimizer', exact: true }),
    '1. Load a build and rotation, then open Gear Optimizer.'
  );
  await show('2. Choose the equipment options to compare for this rotation.', page.locator('.optimizer-columns'));
  // Keep the example small: fixed prefixes and infusions make two relic candidates quick to demonstrate.
  await click(
    page.getByRole('button', { name: "Remove Assassin's from prefixes", exact: true }),
    '3. Remove a prefix to keep this example search small.'
  );
  await click(
    page.getByRole('button', { name: 'Remove Precision from infusionStats', exact: true }),
    '4. Use one infusion stat for this example.'
  );
  // Use the visible searchable picker so the recording shows how users add equipment candidates.
  const relics = page.locator('[data-picker="relic"]');
  await click(
    relics.getByRole('button', { name: 'Add relics', exact: true }),
    '5. Open the relic picker to add another candidate.'
  );
  await relics.getByRole('searchbox').fill('Thief');
  await click(
    relics.getByRole('option').filter({ has: page.locator('.gear-option-name', { hasText: /^Thief$/ }) }),
    '5. Add Thief as an alternative to the equipped Claw relic.'
  );
  await click(
    page.locator('.optimizer-section summary').filter({ hasText: 'Requirements (optional)' }),
    '6. Optional requirements constrain toughness and boon duration.'
  );
  await click(
    page.getByRole('button', { name: 'Run optimizer', exact: true }),
    '7. Run optimizer to evaluate the selected equipment choices.'
  );
  await page.waitForFunction(
    () => ['complete', 'failed'].includes(window.professionApp.gearOptimizerRunner.state.status),
    null,
    { timeout: 180_000 }
  );
  assert.equal(await page.evaluate(() => window.professionApp.gearOptimizerRunner.state.status), 'complete');
  await show(
    '8. Compare ranked results against the equipped build.',
    page.locator('[data-role="optimizer-results"]'),
    3500
  );
  await click(page.locator('[data-preview="0"]'), '9. Click a result to preview its gear and attributes.');
  await show(
    '10. Review the character preview before applying a result.',
    page.locator('[data-role="optimizer-preview"]'),
    3500
  );
  await click(
    page.locator('[data-role="optimizer-preview"] [data-apply]'),
    '11. Apply gear equips that result and recalculates the build.'
  );
  await ready();
  await show('12. Scroll down to Relic break-even comparison.', page.locator('#optimizer-relic-comparison'));
  const comparison = page.locator('#optimizer-relic-comparison');
  await click(
    comparison.getByRole('button', { name: 'Comparison relic', exact: true }),
    '13. Open the comparison relic picker.'
  );
  await comparison.getByRole('searchbox').fill('Thorns');
  await click(
    comparison.getByRole('option').filter({ has: page.locator('.gear-option-name', { hasText: /^Thorns$/ }) }),
    '13. Select Thorns to compare it with the equipped relic.'
  );
  await show(
    '13. Choose a comparison relic; set starting stacks for Thorns.',
    page.locator('[data-role="relic-comparison-stacks"]')
  );
  await page.locator('[data-role="relic-comparison-stacks"]').fill('0');
  await click(
    page.locator('[data-role="relic-comparison-run"]'),
    '14. Run comparison against your currently equipped relic.'
  );
  await expect(page.locator('[data-role="relic-comparison-chart"]')).toBeVisible({ timeout: 180_000 });
  await show(
    '15. Hover the chart to compare DPS across fight durations.',
    page.locator('[data-role="relic-comparison-chart"]'),
    4500
  );
  await page.close();
} finally {
  await browser.close();
}

await writeFile(`${output}/manifest.json`, JSON.stringify(recordings, null, 2));
// Pillow encodes screenshot frames without a video dependency; decode each output to verify size, timing and looping.
execFileSync(
  process.env.PYTHON || 'python',
  [
    '-c',
    `
import json
from pathlib import Path
from PIL import Image
for recording in json.loads(Path('${output}/manifest.json').read_text()):
    frames = [Image.open(frame['path']).convert('RGB').quantize(colors=256) for frame in recording['frames']]
    destination = Path('images/tutorials') / ('gw2-combat-simulator-' + recording['name'] + '.gif')
    frames[0].save(destination, save_all=True, append_images=frames[1:], duration=[frame['duration'] for frame in recording['frames']], loop=0, optimize=True, disposal=1)
    with Image.open(destination) as result:
        assert result.size == (1280, 900) and result.n_frames > 8 and result.info['loop'] == 0
        duration = 0
        for i in range(result.n_frames):
            result.seek(i)
            result.load()
            duration += result.info['duration']
        assert duration >= 20000
        print(f'{destination}: {result.n_frames} frames, {duration / 1000:.1f}s, {destination.stat().st_size / 1024 / 1024:.2f} MiB')
`
  ],
  { stdio: 'inherit' }
);
