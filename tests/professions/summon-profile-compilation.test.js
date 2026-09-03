import assert from 'node:assert/strict';
import test from 'node:test';

import {
  elementalForGlyphId,
  elementalRuntimeProfile,
  selectedElementalFromSkills
} from '#gw2/content/professions/elementalist/core/mechanics/elementals/attacks.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST_ID } from '#gw2/content/professions/elementalist/data/ids.js';
import {
  commandDefinitionFor,
  minionDefinitionForSkill
} from '#gw2/content/professions/necromancer/core/mechanics/minion-profiles.js';
import { NECROMANCER_MINION_PROFILE_BY_SKILL_ID } from '#gw2/content/professions/necromancer/core/profiles.js';
import {
  rangerPetAutoProfile,
  rangerPetBaseAttributes
} from '#gw2/content/professions/ranger/core/mechanics/pet-profiles.js';

test('elemental profile selection is independent from scheduler state', () => {
  assert.equal(selectedElementalFromSkills(new Set(['Glyph of Elementals (Earth)'])), 'Earth');
  assert.equal(elementalForGlyphId(ELEMENTALIST_ID.GLYPH_OF_ELEMENTALS), 'Fire');
  assert.equal(elementalRuntimeProfile('Earth').stomp.skillId, ELEMENTALIST_ID.STOMP_ELEMENTAL_COMMAND);
});

test('pet profile data exposes base attributes and autonomous cadence', () => {
  assert.equal(rangerPetBaseAttributes('Tiger').precision, 2211);
  assert.equal(rangerPetBaseAttributes('Jacaranda').healingPower, 1200);
  assert.equal(rangerPetAutoProfile('Carrion Devourer').basic.recovery, 1.88);
  assert.equal(rangerPetAutoProfile('Unknown'), null);
});

test('minion profile compilation normalizes profile and command packets', () => {
  const [skillId, profileId] = Object.entries(NECROMANCER_MINION_PROFILE_BY_SKILL_ID)[0];
  const context = {
    catalog: {
      balanceProfilesById: new Map([
        [
          profileId,
          {
            name: 'Test Minion',
            minionKey: 'test',
            minionCount: 2,
            pulseInterval: 3,
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
  const summon = minionDefinitionForSkill(context, Number(skillId));
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
