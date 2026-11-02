import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { patchTraitProfession } from '#tests/helpers/trait-patch.js';

// Named profile grants must agree in the isolated preview, live attributes, and tooltip, including boon gates.
test('Mesmer named attribute grants follow the selected patch and their independent boon assumptions', () => {
  const ids = [TRAIT.CHAOTIC_PERSISTENCE, TRAIT.SHARPENING_SORROW];
  const family = withPatchPreview(mesmerProfession, {
    id: 'named-attributes',
    label: 'Named attributes',
    professions: {
      mesmer: {
        balanceProfiles: Object.fromEntries(
          ids.map((id) => [
            id,
            {
              fields: Object.fromEntries(
                Object.keys(mesmerCatalog.balanceProfilesById.get(id).attributeBonuses).map((key) => [
                  `attributeBonuses.${key}`,
                  { add: 37 }
                ])
              )
            }
          ])
        )
      }
    }
  });
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(mesmerCatalog),
    family.attributeContributions
  );
  for (const patchId of ['current', 'named-attributes', 'current']) {
    const balance = family.resolvePatch({ id: patchId }).balanceContext;
    const chaos = balance.catalog.balanceProfilesById.get(ids[0]).attributeBonuses;
    const sorrow = balance.catalog.balanceProfilesById.get(ids[1]).attributeBonuses;
    for (const enabled of [true, false]) {
      const assumptions = { regeneration: enabled, fury: enabled };
      const build = {
        assumptions,
        specializations: [
          { name: 'Chaos', traits: '1-1-1' },
          { name: 'Virtuoso', traits: '1-3-1' }
        ]
      };
      const preview = calculate(build, [], 1, null, null, balance).attributes;
      const expertise = enabled ? chaos.expertise + sorrow.expertise : 0;
      const concentration = enabled ? chaos.concentration : 0;
      assert.equal(preview.Expertise.traits, expertise);
      assert.equal(preview.Concentration.traits, concentration);
      const samples = [];
      const result = runMesmer(
        [{ type: 'wait', durationMs: 1000 }],
        {
          ...createDefaultConfig(),
          patchId,
          selectedTraitIds: ids,
          boons: assumptions,
          attributeInputs: baseAttributeInputs({ expertise: 0, concentration: 0 })
        },
        {
          profession: family,
          timeline: [
            {
              at: 0.5,
              run(runtime) {
                const stats = runtime.combat.statsAt(runtime.time, null, runtime);
                samples.push({ expertise: stats.expertise, concentration: stats.concentration });
              }
            }
          ]
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(samples, [{ expertise, concentration }]);
    }

    for (const id of ids) {
      const profile = balance.catalog.balanceProfilesById.get(id);
      const tooltip = describeSimulationTrait(balance, { id, name: profile.name }, mesmerTooltips);
      for (const [attribute, amount] of Object.entries(profile.attributeBonuses)) {
        const name = attribute[0].toUpperCase() + attribute.slice(1);
        assert.equal(tooltip.facts.find((fact) => fact.name === name).detail, String(amount));
      }
    }
  }
});

test('Mesmer Core and elite build owners consume patched values with independent boon assumptions', () => {
  // Native composition applies each selected contribution once and keeps preview overrides local to that calculation.
  const family = patchTraitProfession(mesmerProfession, {
    balanceProfiles: {
      [TRAIT.CHAOTIC_PERSISTENCE]: {
        fields: { 'attributeBonuses.expertise': 180, 'attributeBonuses.concentration': 320 }
      },
      [TRAIT.FLOW_OF_TIME]: { fields: { criticalChance: 0.2 } }
    }
  });
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(mesmerCatalog),
    family.attributeContributions
  );
  const build = {
    specializations: [
      { name: 'Chaos', traits: '1-1-1' },
      { name: 'Chronomancer', traits: '1-1-1' }
    ]
  };
  for (const [patchId, expertise, concentration] of [
    ['current', 100, 250],
    ['s4-preview', 180, 320]
  ]) {
    const balance = family.resolvePatch({ id: patchId }).balanceContext;
    const attributes = calculate(build, [], 1, null, null, balance).attributes;
    assert.equal(attributes.Expertise.traits, expertise);
    assert.equal(attributes.Concentration.traits, concentration);
    const withoutFlow = calculate(build, [], 1, 'Flow of Time', null, balance).attributes;
    assert.equal(
      attributes['Critical Chance'].final - withoutFlow['Critical Chance'].final,
      patchId === 'current' ? 15 : 20
    );
    const disabled = calculate(build, [], 1, 'Chaotic Persistence', null, balance).attributes;
    assert.equal(disabled.Expertise.traits, 0);
    assert.equal(disabled.Concentration.traits, 0);
    const withoutRegeneration = calculate(
      { ...build, assumptions: { regeneration: false } },
      [],
      1,
      null,
      null,
      balance
    ).attributes;
    assert.equal(withoutRegeneration.Expertise.traits, 0);
    assert.equal(withoutRegeneration.Concentration.traits, 0);
  }
});
