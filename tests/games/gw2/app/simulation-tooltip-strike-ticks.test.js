import assert from 'node:assert/strict';
import test from 'node:test';
import { describeSimulationSkill, simulationEffectFacts } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { necromancerTooltips } from '#gw2/professions/necromancer/app/tooltips.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

// Signet's flat formula lives on its ticks, so presentation must follow the selected packets rather than their zero coefficient.
test('Signet of Vampirism tooltip exposes the selected per-tick damage formula', () => {
  const profession = withPatchPreview(necromancerProfession, {
    id: 'vampirism-tooltip',
    label: 'Vampirism tooltip',
    professions: {
      necromancer: {
        skills: {
          [ID.SIGNET_OF_VAMPIRISM]: {
            effects: [
              {
                type: 'strike',
                tickIndex: 'all',
                flatStrikeBase: 250,
                flatStrikePowerCoeff: 0.1
              }
            ]
          }
        }
      }
    }
  });
  for (const [patchId, base, power] of [
    ['current', 163, 0.05],
    ['vampirism-tooltip', 250, 0.1]
  ]) {
    const context = profession.balanceContextFor(patchId);
    const model = describeSimulationSkill(
      context,
      context.catalog.skillsById.get(ID.SIGNET_OF_VAMPIRISM),
      necromancerTooltips
    );
    const damage = model.facts.find((fact) => fact.name === 'Strike damage');
    assert.ok(damage.detail.includes(`${base} base damage`));
    assert.ok(damage.detail.includes(`${power} × power`));
    assert.doesNotMatch(damage.detail, /0 coefficient/);
    assert.equal(model.incomplete, false);
  }
});

// Inherited formula fields and tick overrides must remain distinct while identical packets combine.
test('flat strike facts preserve tick overrides and group matching formulas', () => {
  const model = simulationEffectFacts([
    {
      type: 'strike',
      flatStrikeBase: 100,
      flatStrikePowerCoeff: 0.2,
      noCrit: true,
      ticks: [
        { atMs: 0, coefficient: 0 },
        { atMs: 1000, coefficient: 0 },
        { atMs: 2000, coefficient: 0, flatStrikeBase: 150, flatStrikePowerCoeff: 0.3 }
      ]
    }
  ]);
  assert.deepEqual(
    model.facts.map(({ detail, applications }) => ({ detail, applications })),
    [
      { detail: '100 base damage · 0.2 × power · cannot critically strike', applications: 2 },
      { detail: '150 base damage · 0.3 × power · cannot critically strike', applications: 1 }
    ]
  );
  assert.equal(model.incomplete, false);
});
