// Entry boons belong to the attunement skill; Arcane extends and shares one grant before duration scaling.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

const entries = [
  [ID.FIRE_ATTUNEMENT, 'might', 10, 15],
  [ID.WATER_ATTUNEMENT, 'regeneration', 3, 5],
  [ID.AIR_ATTUNEMENT, 'swiftness', 5, 8],
  [ID.EARTH_ATTUNEMENT, 'protection', 3, 5]
];

for (const specialization of ['Core', 'Tempest', 'Catalyst', 'Weaver']) {
  test(`${specialization} scales one attunement boon and shares it only with Elemental Attunement`, () => {
    for (const traited of [false, true]) {
      for (const [skillId, kind, baseDuration, traitDuration] of entries) {
        const result = runElementalist(
          [{ type: 'combat-start' }, { type: 'cast', skillId }, { type: 'wait', durationMs: 1000 }],
          {
            specialization,
            startAttunement: skillId === ID.FIRE_ATTUNEMENT ? 'Water' : 'Fire',
            secondaryAttunement: 'Water',
            selectedTraitIds: traited ? [TRAIT.ELEMENTAL_ATTUNEMENT, TRAIT.ELEMENTAL_ENCHANTMENT] : [],
            attributeInputs: baseAttributeInputs({ concentration: 240 }),
            allies: { count: 9 }
          }
        );
        assert.deepEqual(result.warnings, []);
        const grants = result.resolvedEvents.filter(
          (event) => event.type === 'buff' && event.skillId === skillId && event.kind === kind
        );
        assert.equal(grants.length, 1, `${kind} must not retain a separate trait grant`);
        const [grant] = grants;
        const expectedDuration = traited ? traitDuration * 1.28 : baseDuration * 1.16;
        assert.ok(Math.abs(grant.duration - expectedDuration) < 1e-9);
        assert.equal(grant.stacks, 1);
        assert.equal(grant.resolvedAudience.includesSelf, true);
        assert.equal(grant.resolvedAudience.alliedPlayerCount, traited ? 4 : 0);
        assert.equal(grant.sourceId, traited ? TRAIT.ELEMENTAL_ATTUNEMENT : skillId);
      }
    }
  });
}

test('attunement boons can be prepared without entering combat', () => {
  for (const selectedTraitIds of [[], [TRAIT.ELEMENTAL_ATTUNEMENT]]) {
    const result = runElementalist(
      [{ type: 'cast', skillId: ID.FIRE_ATTUNEMENT }, { type: 'wait', durationMs: 1000 }, { type: 'combat-start' }],
      { startAttunement: 'Water', selectedTraitIds }
    );
    assert.deepEqual(result.warnings, []);
    const grant = result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === 'might');
    assert.ok(grant.at < result.combatStartTime);
    assert.ok(grant.at + grant.duration > result.combatStartTime);
  }
});

test('Weaver double-attuning does not repeat an entry boon', () => {
  for (const selectedTraitIds of [[], [TRAIT.ELEMENTAL_ATTUNEMENT]]) {
    const result = runElementalist(
      [
        { type: 'combat-start' },
        { type: 'cast', skillId: ID.FIRE_ATTUNEMENT },
        { type: 'wait', durationMs: 5000 },
        { type: 'cast', skillId: ID.FIRE_ATTUNEMENT },
        { type: 'wait', durationMs: 1000 }
      ],
      { specialization: 'Weaver', startAttunement: 'Air', secondaryAttunement: 'Water', selectedTraitIds }
    );
    assert.deepEqual(result.warnings, []);
    const swaps = result.events.filter((event) => event.type === 'elementalist.attunement');
    assert.equal(swaps.at(-1).to, 'Fire');
    assert.equal(swaps.at(-1).secondaryAttunement, 'Fire');
    const grants = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.skillId === ID.FIRE_ATTUNEMENT && event.kind === 'might'
    );
    assert.equal(grants.length, 1);
  }
});
