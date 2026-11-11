// Legend payloads grant their live effects only when their equipment and completion requirements hold.
import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const conduit = {
  specialization: 'Conduit',
  startingLegend: LEGEND.ENTITY
};
const aegisGrants = (result) =>
  result.resolvedEvents.filter((event) => event.skillId === SKILL.GLADIATORS_DEFENSE && event.kind === 'aegis');

test('Gladiator Dwarf resonance grants self Aegis only after completing the block', () => {
  for (const legend of [LEGEND.DWARF, LEGEND.ASSASSIN]) {
    for (const interrupted of [false, true]) {
      const result = runRevenant([{ name: "Gladiator's Defense", ...(interrupted ? { interruptMs: 200 } : {}) }], {
        ...conduit,
        selectedLegends: [LEGEND.ENTITY, legend],
        allies: { count: 4 }
      });
      assert.deepEqual(result.warnings, []);
      const grants = aegisGrants(result);

      if (legend !== LEGEND.DWARF || interrupted) {
        assert.deepEqual(grants, []);
        continue;
      }

      assert.equal(grants.length, 1);
      assert.equal(grants[0].duration, 5);
      assert.equal(grants[0].resolvedAudience.includesSelf, true);
      assert.equal(grants[0].resolvedAudience.alliedPlayerCount, 0);
      const block = result.resolvedEvents.find((event) => event.kind === 'blocking');
      assert.ok(grants[0].at >= block.at + block.duration);
      assert.equal(
        result.resolvedEvents.some((event) => event.condition === 'Weakness'),
        false
      );
    }
  }
});

test('Gladiator Aegis uses its selected duration and ordinary boon duration bonuses', () => {
  const result = runRevenant(
    [SKILL.GLADIATORS_DEFENSE],
    {
      ...conduit,
      selectedLegends: [LEGEND.ENTITY, LEGEND.DWARF],
      attributeInputs: baseAttributeInputs({ concentration: 750 })
    },
    {
      catalog: (catalog) =>
        applySkillPatch(catalog, {
          skills: {
            [SKILL.GLADIATORS_DEFENSE]: { effects: [{ type: 'boon', boon: 'aegis', duration: 8 }] }
          }
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(aegisGrants(result)[0].duration, 12);
});

test('Forced Engagement applies Cripple without the removed Slow or Taunt', () => {
  const result = runRevenant([SKILL.FORCED_ENGAGEMENT], {
    selectedLegends: [LEGEND.DWARF, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DWARF
  });
  assert.deepEqual(result.warnings, []);
  const effects = result.resolvedEvents.filter((event) => event.skillId === SKILL.FORCED_ENGAGEMENT);
  const conditions = effects.filter((event) => event.type === 'condition');
  assert.deepEqual(
    conditions.map((event) => [event.condition, event.duration]),
    [['Crippled', 5]]
  );
  assert.equal(
    effects.some((event) => event.type === 'control'),
    false
  );
  assert.ok(effects.some((event) => event.type === 'damage' && event.damage > 0));
});
