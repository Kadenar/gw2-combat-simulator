import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '../../js/log-analyzer/dps-report/parser.js';
import { reconstructDpsReportRotation } from '../../js/log-analyzer/dps-report/rotation/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../js/professions/elementalist/data/ids.js';

const skill = (id, name, extras = {}) => ({ id, name, implemented: true, ...extras });

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

  assert.deepEqual(
    result.actions.map(({ name, skillId }) => ({ name, skillId })),
    [
      { name: 'Glyph of Storms (Air)', skillId: ID.GLYPH_OF_STORMS_AIR },
      { name: 'Primordial Stance (Air)', skillId: ID.PRIMORDIAL_STANCE_AIR },
      { name: 'Earth Attunement', skillId: ID.EARTH_ATTUNEMENT },
      { name: 'Primordial Stance (Earth)', skillId: ID.PRIMORDIAL_STANCE_EARTH }
    ]
  );
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('reconstructs the Aerial Agility chain and resets it after another skill or a long gap', () => {
  const report = reportFixture(
    'Elementalist',
    [
      {
        id: ID.AERIAL_AGILITY,
        skills: [
          { castTime: 0, duration: 500, timeGained: 0 },
          { castTime: 500, duration: 500, timeGained: 0 },
          { castTime: 1_000, duration: 500, timeGained: 0 },
          { castTime: 2_000, duration: 500, timeGained: 0 },
          { castTime: 7_001, duration: 500, timeGained: 0 }
        ]
      },
      { id: ID.FIREBALL, skills: [{ castTime: 1_500, duration: 500, timeGained: 0 }] }
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
      'Aerial Agility (chain)',
      'Aerial Agility (dash)',
      'Fireball',
      'Aerial Agility',
      'Aerial Agility'
    ]
  );
});

test('uses default cast times for short report casts without skill commit metadata', () => {
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
    ['interrupted', 'interrupted']
  );
  assert.equal('interruptMs' in result.rotation.find((command) => command.name === 'Flamestrike'), false);
  assert.equal('interruptMs' in result.rotation.find((command) => command.name === 'Arc Lightning'), false);
});

test('recovers an unexplained equipped aura skill from its buff activation', () => {
  const report = reportFixture(
    'Elementalist',
    [
      { id: ID.SIGNET_OF_FIRE, skills: [{ castTime: 4_600, duration: 0, timeGained: 0 }] },
      { id: ID.FIREBALL, skills: [{ castTime: 8_000, duration: 500, timeGained: 0 }] }
    ],
    {
      [`s${ID.SIGNET_OF_FIRE}`]: { name: 'Signet of Fire', isInstantCast: true },
      [`s${ID.FIREBALL}`]: { name: 'Fireball' }
    },
    {
      player: {
        buffUptimes: [
          {
            id: 5677,
            states: [
              [0, 0],
              [1_000, 1],
              [2_000, 0],
              [5_000, 1]
            ]
          }
        ]
      }
    }
  );
  const catalog = {
    skills: [
      skill(ID.FIRE_SHIELD, 'Fire Shield', { type: 'Weapon', castTimeMs: 0 }),
      skill(ID.SIGNET_OF_FIRE, 'Signet of Fire', { type: 'Utility', castTimeMs: 0 }),
      skill(ID.FIREBALL, 'Fireball', { type: 'Weapon', quicknessCastTimeMs: 500 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog, {
    professionConfig: { primaryWeapon: 'Scepter', secondaryWeapon: 'Focus' }
  });

  assert.deepEqual(
    result.actions.filter((action) => action.name === 'Fire Shield').map((action) => action.rawSkillId),
    [ID.FIRE_SHIELD]
  );
  assert.match(result.warnings.join('\n'), /Recovered report evidence:.*Fire Shield/);

  const wrongWeapon = reconstructDpsReportRotation(report, catalog, {
    professionConfig: { primaryWeapon: 'Scepter', secondaryWeapon: 'Dagger' }
  });

  assert.equal(
    wrongWeapon.actions.some((action) => action.name === 'Fire Shield'),
    false
  );
});

test('recovers Blinding Flash unless nearby casts explain both condition applications', () => {
  const report = reportFixture(
    'Elementalist',
    [
      { id: ID.DUST_DEVIL, skills: [{ castTime: 3_900, duration: 400, timeGained: 0 }] },
      { id: ID.LIGHTNING_BLITZ, skills: [{ castTime: 3_950, duration: 0, timeGained: 0 }] },
      { id: ID.FIREBALL, skills: [{ castTime: 7_000, duration: 500, timeGained: 0 }] }
    ],
    {
      [`s${ID.DUST_DEVIL}`]: { name: 'Dust Devil' },
      [`s${ID.LIGHTNING_BLITZ}`]: { name: 'Lightning Blitz', isInstantCast: true },
      [`s${ID.FIREBALL}`]: { name: 'Fireball' }
    },
    {
      targets: [
        {
          buffs: [
            {
              id: 720,
              states: [
                [0, 0],
                [1_000, 1],
                [1_500, 0],
                [4_000, 1]
              ]
            },
            {
              id: 742,
              states: [
                [0, 0],
                [1_040, 1],
                [1_500, 0],
                [4_040, 1]
              ]
            }
          ]
        }
      ]
    }
  );
  const catalog = {
    skills: [
      skill(ID.BLINDING_FLASH, 'Blinding Flash', { type: 'Weapon', castTimeMs: 0 }),
      skill(ID.DUST_DEVIL, 'Dust Devil', { type: 'Weapon', quicknessCastTimeMs: 400 }),
      skill(ID.LIGHTNING_BLITZ, 'Lightning Blitz', { type: 'Profession', castTimeMs: 0 }),
      skill(ID.FIREBALL, 'Fireball', { type: 'Weapon', quicknessCastTimeMs: 500 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog, {
    professionConfig: { primaryWeapon: 'Scepter' }
  });

  assert.deepEqual(
    result.actions.filter((action) => action.name === 'Blinding Flash').map((action) => action.rawSkillId),
    [ID.BLINDING_FLASH]
  );
  assert.match(result.warnings.join('\n'), /Recovered report evidence:.*Blinding Flash/);
});
