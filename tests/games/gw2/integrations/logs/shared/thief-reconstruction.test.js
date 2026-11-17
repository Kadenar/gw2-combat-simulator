// Represent composite attacks and corroborating markers once so replay spends initiative only once per input.
import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { normalizeThiefLogActions } from '#gw2/integrations/logs/shared/rotation/professions/thief.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';

test('Shadow Shot animation segments represent one paid input without consuming an interleaved utility', () => {
  const result = reconstructDpsReportRotation(
    {
      players: [
        {
          name: 'Fixture',
          profession: 'Antiquary',
          rotation: [
            { id: ID.SHADOW_SHOT, skills: [{ castTime: 1000, duration: 240 }] },
            { id: 13039, skills: [{ castTime: 1240, duration: 440 }] },
            { id: ID.ASSASSINS_SIGNET, skills: [{ castTime: 1100, duration: 0 }] }
          ]
        }
      ],
      phases: [{ start: 0, end: 3000, name: 'Full Fight' }],
      skillMap: {
        [`s${ID.SHADOW_SHOT}`]: { name: 'Shadow Shot' },
        s13039: { name: 'Shadow Shot' },
        [`s${ID.ASSASSINS_SIGNET}`]: { name: "Assassin's Signet" }
      }
    },
    thiefCatalog
  );
  const inputs = result.rotation.filter((command) => command.type === 'cast');
  assert.deepEqual(
    inputs.map((command) => command.skillId),
    [ID.SHADOW_SHOT, ID.ASSASSINS_SIGNET]
  );
  const initiative = inputs.reduce((total, command) => {
    const cost = thiefCatalog.skills.find((skill) => skill.id === command.skillId).cost;
    return total + (cost?.resource === 'initiative' ? cost.amount : 0);
  }, 0);
  assert.equal(initiative, 4);
});

test('Infiltrators Strike keeps standalone and accurate markers but suppresses corroborating duplicates', () => {
  const profile = ROTATION_PROFILES.find((entry) => entry.specializationId === 'antiquary');
  const animation = {
    rawSkillId: ID.INFILTRATORS_STRIKE,
    rawName: "Infiltrator's Strike",
    start: 1000,
    end: 1500,
    status: 'completed',
    eventIndex: 1,
    isSwap: false,
    metadataAccurate: false
  };
  const marker = { ...animation, start: 1200, end: 1200, status: 'instant', eventIndex: 2 };
  const accurate = { ...marker, metadataAccurate: true, eventIndex: 3 };
  const outside = { ...marker, start: 2000, end: 2000, eventIndex: 4 };
  const unrelated = { ...marker, rawSkillId: ID.INFILTRATORS_RETURN, eventIndex: 5 };
  const normalize = (recordedActions) => normalizeThiefLogActions({ profile, catalog: thiefCatalog, recordedActions });
  assert.deepEqual(
    new Set(normalize([animation, marker, accurate, outside, unrelated])),
    new Set([animation, accurate, outside, unrelated])
  );
  assert.deepEqual(normalize([marker]), [marker]);
});
