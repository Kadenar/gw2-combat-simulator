import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

const skill = (id, name, extras = {}) => ({ id, name, ...extras });

// These fixtures isolate the EI signals needed for each Elementalist recovery rule.
function reportFixture(profession, rotation, skillMap, extras = {}) {
  const end = extras.end ?? 10_000;

  return parseDpsReport({
    durationMS: end,
    players: [
      {
        name: `Fixture ${profession}`,
        account: 'Fixture.1234',
        profession,
        rotation,
        ...(extras.player || {})
      }
    ],
    targets: extras.targets || [],
    phases: [{ start: 0, end, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap
  });
}

test('tracks Elementalist attunements when resolving EI-only skill names', () => {
  const report = reportFixture(
    'Weaver',
    [
      { id: 5737, skills: [{ castTime: 0, duration: 600, timeGained: 0 }] },
      {
        id: 40183,
        skills: [
          { castTime: 100, duration: 0, timeGained: 0 },
          { castTime: 650, duration: 0, timeGained: 0 }
        ]
      },
      { id: 90_001, skills: [{ castTime: 600, duration: 0, timeGained: 0 }] }
    ],
    {
      s5737: { name: 'Lightning Storm' },
      s40183: { name: 'Primordial Stance', isInstantCast: true },
      s90001: { name: 'Earth Air Attunement', isInstantCast: true, isSwap: true }
    }
  );
  const catalog = {
    skills: [
      skill(ID.GLYPH_OF_STORMS_AIR, 'Glyph of Storms (Air)', {
        type: 'Utility',
        attunement: 'Air',
        quicknessCastTimeMs: 600
      }),
      skill(ID.PRIMORDIAL_STANCE_AIR, 'Primordial Stance (Air)', {
        type: 'Utility',
        castTimeMs: 0,
        independentCast: true
      }),
      skill(ID.EARTH_ATTUNEMENT, 'Earth Attunement', {
        type: 'Profession',
        castTimeMs: 0,
        independentCast: true
      }),
      skill(ID.PRIMORDIAL_STANCE_EARTH, 'Primordial Stance (Earth)', {
        type: 'Utility',
        castTimeMs: 0,
        independentCast: true
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.equal(result.actions.find((action) => action.rawSkillId === 5737)?.skillId, ID.GLYPH_OF_STORMS_AIR);
  assert.equal(result.actions.find((action) => action.name === 'Earth Attunement')?.skillId, ID.EARTH_ATTUNEMENT);
  assert.deepEqual(
    result.actions.filter((action) => action.rawSkillId === 40183).map((action) => action.skillId),
    [ID.PRIMORDIAL_STANCE_AIR, ID.PRIMORDIAL_STANCE_EARTH]
  );
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('reconstructs Aerial Agility across other skills and resets it after a five-second gap', () => {
  const report = reportFixture(
    'Elementalist',
    [
      {
        id: ID.AERIAL_AGILITY,
        skills: [
          { castTime: 0, duration: 500, timeGained: 0 },
          { castTime: 1_000, duration: 500, timeGained: 0 },
          { castTime: 1_500, duration: 500, timeGained: 0 },
          { castTime: 2_500, duration: 500, timeGained: 0 },
          { castTime: 7_501, duration: 500, timeGained: 0 }
        ]
      },
      {
        id: ID.FIREBALL,
        skills: [
          { castTime: 500, duration: 500, timeGained: 0 },
          { castTime: 2_000, duration: 500, timeGained: 0 }
        ]
      }
    ],
    {
      [`s${ID.AERIAL_AGILITY}`]: { name: 'Aerial Agility' },
      [`s${ID.FIREBALL}`]: { name: 'Fireball' }
    }
  );
  const catalog = {
    skills: [
      skill(ID.AERIAL_AGILITY, 'Aerial Agility', { type: 'Weapon', quicknessCastTimeMs: 500 }),
      skill(ID.AERIAL_AGILITY_CHAIN, 'Aerial Agility (chain)', {
        type: 'Weapon',
        quicknessCastTimeMs: 500
      }),
      skill(ID.AERIAL_AGILITY_DASH, 'Aerial Agility (dash)', {
        type: 'Weapon',
        quicknessCastTimeMs: 500
      }),
      skill(ID.FIREBALL, 'Fireball', { type: 'Weapon', quicknessCastTimeMs: 500 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      'Aerial Agility',
      'Fireball',
      'Aerial Agility (chain)',
      'Aerial Agility (dash)',
      'Fireball',
      'Aerial Agility',
      'Aerial Agility'
    ]
  );
});

test('preserves report cast status and duration without inventing skill commit metadata', () => {
  const report = reportFixture(
    'Elementalist',
    [
      { id: ID.FLAMESTRIKE, skills: [{ castTime: 0, duration: 300, timeGained: 0 }] },
      { id: ID.ARC_LIGHTNING, skills: [{ castTime: 500, duration: 2_000, timeGained: 0 }] }
    ],
    {
      [`s${ID.FLAMESTRIKE}`]: { name: 'Flamestrike' },
      [`s${ID.ARC_LIGHTNING}`]: { name: 'Arc Lightning' }
    }
  );
  const catalog = {
    skills: [
      skill(ID.FLAMESTRIKE, 'Flamestrike', { type: 'Weapon', quicknessCastTimeMs: 600 }),
      skill(ID.ARC_LIGHTNING, 'Arc Lightning', { type: 'Weapon', quicknessCastTimeMs: 2_720 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.deepEqual(
    result.actions.map((action) => action.status),
    ['completed', 'completed']
  );
  assert.equal(result.rotation.find((command) => command.name === 'Flamestrike').interruptMs, 320);
  assert.equal(result.rotation.find((command) => command.name === 'Arc Lightning').interruptMs, 2_000);
});
