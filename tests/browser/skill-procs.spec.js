import { expect, test } from '@playwright/test';

// Only the selected effect's activations appear, even when it triggers another proc at the same time.
test('skill details group proc counts by trigger and disclose only that skill’s times', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ url: '/css/style.css' });
  await page.evaluate(async () => {
    const { createGw2SimulationViewModel } = await import('/js/games/gw2/app/results/view.ts');
    document.body.innerHTML = '<main id="results"></main>';
    const view = createGw2SimulationViewModel({
      skillByName: new Map(),
      skillById: new Map(),
      build: { rotation: [{ type: 'wait', durationMs: 10000 }], targetHealth: 100000 },
      results: {
        duration: 10,
        dpsStartTime: 1.5,
        dpsWindow: 8.5,
        totalDamage: 455,
        conditionDamage: 425,
        breakdown: [
          { name: 'Strength of Stone', conditionDamage: 425, actorType: 'effect' },
          { name: 'Earthen Rush', strikeDamage: 10, actorType: 'player' },
          { name: 'Other skill', strikeDamage: 10, actorType: 'player' },
          { name: 'Earthen Rush', strikeDamage: 10, actorType: 'summon' }
        ],
        resolvedEvents: [
          { type: 'damage', name: 'Earthen Rush', actorType: 'player', at: 2, damage: 10 },
          // Unequal damage per activation prevents the summary from estimating totals using proc counts.
          ...[
            {
              at: 2,
              triggeredBy: 'Earthen Rush',
              damage: 120,
              damageTicks: [
                { at: 3, damage: 50 },
                { at: 4, damage: 70 }
              ]
            },
            { at: 5.5, triggeredBy: 'Signet <of Earth>', damage: 255, damageTicks: [{ at: 6.5, damage: 255 }] },
            { at: 9, triggeredBy: 'Earthen Rush', damage: 50, damageTicks: [{ at: 10, damage: 50 }] }
          ].map((event) => ({ type: 'condition', name: 'Strength of Stone', actorType: 'effect', ...event })),
          {
            type: 'condition',
            name: 'Relic of the Fractal',
            actorType: 'effect',
            at: 2,
            triggeredBy: 'Strength of Stone',
            damage: 999
          }
        ],
        procSteps: [
          { skill: 'Strength of Stone', sourceSkill: 'Earthen Rush', start: 9000 },
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
  await expect(procs.locator('.chart-panel-title')).toHaveText('Procs (3)');
  await expect(procs.locator('summary')).toHaveText([
    'Earthen Rush — 2 procs — (170 damage | 20 DPS)',
    'Signet <of Earth> — 1 proc — (255 damage | 30 DPS)'
  ]);
  const rush = procs.locator('details').filter({ hasText: 'Earthen Rush' });
  const signet = procs.locator('details').filter({ hasText: 'Signet <of Earth>' });
  await expect(rush.locator('table')).toBeHidden();
  await expect(signet.locator('table')).toBeHidden();
  await rush.locator('summary').click();
  await expect(rush.locator('table')).toBeVisible();
  await expect(rush.locator('td')).toHaveText(['0.50s', '7.50s']);
  await expect(signet.locator('table')).toBeHidden();
  await signet.locator('summary').focus();
  await signet.locator('summary').press('Enter');
  await expect(signet.locator('table')).toBeVisible();
  await expect(signet.locator('td')).toHaveText(['4.00s']);
  await rush.locator('summary').click();
  await expect(rush.locator('table')).toBeHidden();
  await expect(signet.locator('table')).toBeVisible();
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
