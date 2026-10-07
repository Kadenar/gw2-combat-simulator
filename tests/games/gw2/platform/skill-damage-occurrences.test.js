import assert from 'node:assert/strict';
import test from 'node:test';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';

// Both trait ownership paths must accept the same selection representations as simulation.
for (const { profession, ownerId, occurrenceId } of [
  {
    profession: thiefProfession,
    ownerId: THIEF_TRAIT_IDS.MUG,
    occurrenceId: `profile:${THIEF_TRAIT_IDS.MUG}`
  },
  {
    profession: elementalistProfession,
    ownerId: ELEMENTALIST_TRAIT_IDS.ELECTRIC_DISCHARGE,
    occurrenceId: 'profession:elementalist.ElectricDischarge'
  }
]) {
  test(`${occurrenceId} normalizes selected trait IDs without duplicating or including unselected owners`, () => {
    const runtime = profession.runtimeFor({ specialization: 'Core' });
    for (const selectedTraitIds of [
      [ownerId],
      [String(ownerId)],
      [`0${ownerId}`],
      [ownerId, String(ownerId), `0${ownerId}`],
      [],
      [999999],
      undefined
    ]) {
      const entries = damageOccurrences(runtime, { specialization: 'Core', selectedTraitIds });
      const matches = entries.filter((entry) => entry.id === occurrenceId);
      assert.equal(matches.length, selectedTraitIds?.includes(999999) || !selectedTraitIds?.length ? 0 : 1);
    }
  });
}

// Normalization must preserve symbolic owners and recognize numeric owners authored as strings.
for (const ownerId of ['custom.trait', '01276']) {
  test(`trait occurrences retain string owner ${ownerId} at both gates`, () => {
    const runtime = {
      catalog: {
        balanceProfiles: [{ id: ownerId, name: 'Profile', effects: [{ type: 'strike', coefficient: 1 }] }],
        traits: [],
        skillsById: new Map()
      },
      damageEffects: []
    };
    const config = { selectedTraitIds: [ownerId] };
    assert.deepEqual(
      damageOccurrences(runtime, config).map((entry) => entry.id),
      [`profile:${ownerId}`]
    );
    runtime.damageEffects.push({
      id: 'declared',
      ownerId,
      name: 'Declared',
      source: 'Trait',
      unit: 'occurrence',
      sourceIds: []
    });
    assert.deepEqual(
      damageOccurrences(runtime, config).map((entry) => entry.id),
      ['profession:declared']
    );
    assert.deepEqual(damageOccurrences(runtime, { selectedTraitIds: [] }), []);
  });
}
