import { expect, test } from '@playwright/test';

// Only the selected effect's activations appear, even when it triggers another proc at the same time.
test('skill details show proc times and triggering skills on the DPS clock', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { createGw2SimulationViewModel } = await import('/js/games/gw2/app/results/view.ts');
    document.body.innerHTML = '<main id="results"></main>';
    const view = createGw2SimulationViewModel({
      skillByName: new Map(),
      skillById: new Map(),
      build: { rotation: [{ type: 'wait', durationMs: 8000 }], targetHealth: 100000 },
      results: {
        duration: 8,
        dpsStartTime: 1.5,
        totalDamage: 60,
        conditionDamage: 30,
        breakdown: [
          { name: 'Strength of Stone', conditionDamage: 30, actorType: 'effect' },
          { name: 'Earthen Rush', strikeDamage: 10, actorType: 'player' },
          { name: 'Other skill', strikeDamage: 10, actorType: 'player' },
          { name: 'Earthen Rush', strikeDamage: 10, actorType: 'summon' }
        ],
        resolvedEvents: [{ type: 'damage', name: 'Earthen Rush', actorType: 'player', at: 2, damage: 10 }],
        procSteps: [
          { skill: 'Relic of the Fractal', sourceSkill: 'Strength of Stone', start: 2000 },
          { skill: 'Strength of Stone', sourceSkill: 'Signet <of Earth>', start: 5500 },
          { skill: 'Strength of Stone', sourceSkill: 'Earthen Rush', start: 2000 }
        ]
      }
    });
    view.analysis.panels[0].mount(document.querySelector('#results'));
  });

  const trait = page.locator('[data-skill-key="Player|Strength of Stone"]');
  const source = page.locator('[data-skill-key="Player|Earthen Rush"]');
  const procs = page.locator('[data-role="skill-procs"]');
  await trait.click();
  await expect(procs.locator('caption')).toHaveText('Procs (2)');
  await expect(procs.locator('tbody tr')).toHaveCount(2);
  await expect(procs.locator('tbody tr').first().locator('td')).toHaveText(['0.50s', 'Earthen Rush']);
  await expect(procs.locator('tbody tr').last().locator('td')).toHaveText(['4.00s', 'Signet <of Earth>']);
  await expect(procs).not.toContainText('Relic of the Fractal');
  await expect(procs.locator('signet')).toHaveCount(0);

  await page.locator('[data-sort-col="name"]').click();
  await expect(trait).toHaveAttribute('aria-pressed', 'true');
  await expect(procs).toBeVisible();
  await source.focus();
  await source.press('Enter');
  await expect(procs).toHaveCount(0);
  await expect(page.locator('[data-role="skill-timeline"] canvas')).not.toHaveCount(0);
  await source.press('Space');
  await expect(page.locator('[data-role="skill-timeline"]')).toHaveCount(0);

  for (const key of ['Player|Other skill', 'Entities|Earthen Rush']) {
    await page.locator(`[data-skill-key="${key}"]`).click();
    await expect(procs).toHaveCount(0);
  }
});
