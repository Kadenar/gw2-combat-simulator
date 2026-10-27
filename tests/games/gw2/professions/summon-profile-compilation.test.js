import assert from 'node:assert/strict';
import test from 'node:test';

import {
  elementalForGlyphId,
  elementalRuntimeProfile,
  selectedElementalFromSkills
} from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST_ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  commandDefinitionFor,
  minionDefinitionForSkill
} from '#gw2/professions/necromancer/core/mechanics/minion-profiles.js';
import { NECROMANCER_MINION_SUMMON_IDS } from '#gw2/professions/necromancer/core/skills/minion-attacks.js';
import { rangerPetAutoProfile, rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';

test('elemental profile selection is independent from scheduler state', () => {
  assert.equal(selectedElementalFromSkills(new Set([ELEMENTALIST_ID.GLYPH_OF_ELEMENTALS_EARTH])), 'Earth');
  assert.equal(elementalForGlyphId(ELEMENTALIST_ID.GLYPH_OF_ELEMENTALS), 'Fire');
  assert.equal(elementalRuntimeProfile('Earth').stomp.skillId, ELEMENTALIST_ID.STOMP_ELEMENTAL_COMMAND);
});

test('pet profile data exposes base attributes and autonomous cadence', () => {
  assert.equal(rangerPetBaseAttributes('Tiger').precision, 2211);
  assert.equal(rangerPetBaseAttributes('Jacaranda').healingPower, 1200);
  assert.equal(rangerPetAutoProfile('Carrion Devourer').basic.recovery, 1.88);
  assert.equal(rangerPetAutoProfile('Unknown'), null);
});

test('minion compilation normalizes selected summon, actor, and command packets', () => {
  const [skillId] = NECROMANCER_MINION_SUMMON_IDS;
  const attackId = 'fixture.minion.attack';
  const context = {
    catalog: {
      // Summon count and autonomous attacks come from their separate canonical skill owners.
      skillsById: new Map([
        [skillId, { id: skillId, minionCount: 2, summonAttackId: attackId }],
        [
          attackId,
          {
            id: attackId,
            name: 'Test Minion',
            minionKey: 'test',
            pulseInterval: 3,
            // Supply required actor fields so this fixture reaches its packet-normalization assertions.
            openingAttackWindupMs: 0,
            // Each canonical attack owns its weapon strength after the shared profile migration.
            weaponStrength: 1048,
            basePower: 1000,
            damagePerCoefficient: 1000,
            criticalChance: 0.05,
            criticalDamage: 1.5,
            alternateEvery: 4,
            effects: [
              { type: 'strike', coefficient: 0.5 },
              { type: 'strike', packetLabel: 'alternate', coefficient: 1 },
              { type: 'condition', packetLabel: 'alternate', condition: 'Bleeding', stacks: 2, duration: 4 }
            ]
          }
        ]
      ])
    }
  };
  const summon = minionDefinitionForSkill(context, skillId);
  assert.deepEqual(
    {
      key: summon.key,
      count: summon.count,
      interval: summon.interval,
      alternateCondition: summon.alternateAttacks[0].condition
    },
    { key: 'test', count: 2, interval: 3, alternateCondition: ['Bleeding', 2, 4] }
  );

  const command = commandDefinitionFor({
    name: 'Test Command',
    minionKey: 'test',
    effects: [
      { type: 'strike', coefficient: 1.25 },
      { type: 'condition', condition: 'Poisoned', stacks: 3, duration: 5 }
    ]
  });
  assert.equal(command.coefficient, 1.25);
  assert.deepEqual(command.conditions, [['Poisoned', 3, 5]]);
});
