import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';

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
      { id: ID.SIGNET_OF_FIRE, skills: [{ castTime: 4_600, duration: 400, timeGained: 0 }] },
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

test('reconstructs Evoker scepter/focus setup from report weapons, buffs, and hit totals', () => {
  const report = reportFixture(
    'Evoker',
    [
      { id: ID.FLAMEWALL, skills: [{ castTime: -560, duration: 560, timeGained: 0 }] },
      { id: ID.SIGNET_OF_FIRE, skills: [{ castTime: 0, duration: 519, timeGained: 0 }] },
      {
        id: ID.IGNITE,
        skills: [
          { castTime: 1_000, duration: 0, timeGained: 0 },
          { castTime: 9_500, duration: 0, timeGained: 0 }
        ]
      },
      {
        id: 25499,
        skills: [
          { castTime: 3_000, duration: 0, timeGained: 0 },
          { castTime: 8_500, duration: 0, timeGained: 0 }
        ]
      },
      { id: ID.PHOENIX, skills: [{ castTime: 1_120, duration: 480, timeGained: 0 }] },
      { id: ID.TRANSMUTE_FIRE, skills: [{ castTime: 1_600, duration: 360, timeGained: 0 }] },
      { id: ID.DRAGONS_TOOTH, skills: [{ castTime: 2_600, duration: 680, timeGained: 0 }] },
      { id: ID.CONFLAGRATION, skills: [{ castTime: 3_280, duration: 360, timeGained: 0 }] }
    ],
    {
      [`s${ID.FLAMEWALL}`]: { name: 'Flamewall' },
      [`s${ID.SIGNET_OF_FIRE}`]: { name: 'Signet of Fire' },
      [`s${ID.IGNITE}`]: { name: 'Ignite', isInstantCast: true },
      s25499: { name: 'Flame Barrage', isInstantCast: true },
      [`s${ID.PHOENIX}`]: { name: 'Phoenix' },
      [`s${ID.TRANSMUTE_FIRE}`]: { name: 'Transmute Fire' },
      [`s${ID.DRAGONS_TOOTH}`]: { name: "Dragon's Tooth" },
      [`s${ID.CONFLAGRATION}`]: { name: 'Conflagration' }
    },
    {
      targets: [{}],
      player: {
        weaponSets: [{ weapons: ['Scepter', 'Focus'], timeframe: [0, 10_000] }],
        minions: [
          {
            id: 6524,
            name: 'Fire Elemental',
            targetDamageDist: [[[{ id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, connectedHits: 10 }]]]
          }
        ],
        targetDamageDist: [
          [
            [
              { id: ID.DRAGONS_TOOTH, connectedHits: 2 },
              { id: 76882, connectedHits: 2 }
            ]
          ]
        ],
        buffUptimes: [
          {
            id: 5677,
            states: [
              [0, 0],
              [1_280, 1],
              [1_920, 0],
              [3_560, 1],
              [6_560, 0]
            ]
          }
        ]
      }
    }
  );
  const catalog = {
    skills: [
      skill(ID.FLAMEWALL, 'Flamewall', { type: 'Weapon', quicknessCastTimeMs: 560 }),
      skill(ID.SIGNET_OF_FIRE, 'Signet of Fire', { type: 'Utility', quicknessCastTimeMs: 520 }),
      skill(ID.IGNITE, 'Ignite', {
        type: 'Profession',
        castTimeMs: 0,
        independentCast: true,
        effects: [
          {
            type: 'strike',
            ticks: [{ atMs: 880, coefficient: 0.63 }],
            timingAnchor: 'castStart',
            timingScale: 'cast'
          }
        ]
      }),
      skill(ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, 'Flame Barrage', {
        type: 'Elite',
        castTimeMs: 0,
        independentCast: true
      }),
      skill(ID.FIRE_SHIELD, 'Fire Shield', { type: 'Weapon', castTimeMs: 0, independentCast: true }),
      skill(ID.PHOENIX, 'Phoenix', { type: 'Weapon', quicknessCastTimeMs: 480 }),
      skill(ID.TRANSMUTE_FIRE, 'Transmute Fire', { type: 'Weapon', quicknessCastTimeMs: 360 }),
      skill(ID.DRAGONS_TOOTH, "Dragon's Tooth", { type: 'Weapon', quicknessCastTimeMs: 680 }),
      skill(ID.CONFLAGRATION, 'Conflagration', { type: 'Profession', quicknessCastTimeMs: 360 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);
  const dragonsTeeth = result.actions.filter((action) => action.name === "Dragon's Tooth");
  const fireShields = result.actions.filter((action) => action.name === 'Fire Shield');

  assert.equal(dragonsTeeth.length, 2);
  assert.equal(dragonsTeeth[0].inferred, true);
  assert.equal(dragonsTeeth[0].timestampMs, 0);
  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Ignite')
      .map(({ timestampMs, inferred }) => ({ timestampMs, inferred })),
    [
      { timestampMs: 360, inferred: true },
      { timestampMs: 2_240, inferred: false },
      { timestampMs: 10_740, inferred: false }
    ]
  );
  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Flame Barrage')
      .map(({ timestampMs, inferred }) => ({ timestampMs, inferred })),
    [
      { timestampMs: 120, inferred: true },
      { timestampMs: 4_240, inferred: false },
      { timestampMs: 9_740, inferred: false }
    ]
  );
  assert.deepEqual(
    fireShields.map(({ timestampMs, inferred }) => ({ timestampMs, inferred })),
    [{ timestampMs: 2_520, inferred: true }]
  );
  assert.ok(
    result.rotation.findIndex((command) => command.name === 'Fire Shield') <
      result.rotation.findIndex((command) => command.name === 'Transmute Fire')
  );
  assert.match(
    result.warnings.join('\n'),
    /Recovered report evidence:.*Dragon's Tooth.*Flame Barrage.*Ignite.*Fire Shield/
  );
});

test('recovers an opening spear etching from its full flip', () => {
  const report = reportFixture(
    'Evoker',
    [
      { id: ID.GLYPH_OF_STORMS_AIR, skills: [{ castTime: -880, duration: 1_120, timeGained: 0 }] },
      { id: 25499, skills: [{ castTime: 12_520, duration: 0, timeGained: 0 }] },
      { id: ID.DERECHO, skills: [{ castTime: 760, duration: 600, timeGained: 0 }] },
      { id: ID.ETCHING_DERECHO, skills: [{ castTime: 15_200, duration: 240, timeGained: 0 }] }
    ],
    {
      [`s${ID.GLYPH_OF_STORMS_AIR}`]: { name: 'Lightning Storm' },
      s25499: { name: 'Flame Barrage' },
      [`s${ID.DERECHO}`]: { name: 'Derecho' },
      [`s${ID.ETCHING_DERECHO}`]: { name: 'Etching: Derecho' }
    },
    {
      targets: [{}],
      player: {
        weaponSets: [{ weapons: ['Spear'], timeframe: [0, 20_000] }],
        minions: [
          {
            id: 6524,
            name: 'Fire Elemental',
            targetDamageDist: [[[{ id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, connectedHits: 5 }]]]
          }
        ]
      }
    }
  );
  const catalog = {
    skills: [
      skill(ID.GLYPH_OF_STORMS_AIR, 'Glyph of Storms (Air)', {
        type: 'Utility',
        quicknessCastTimeMs: 1_120
      }),
      skill(ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, 'Flame Barrage', {
        type: 'Elite',
        castTimeMs: 0,
        independentCast: true
      }),
      skill(ID.DERECHO, 'Derecho', { type: 'Weapon', weapon: 'Spear', quicknessCastTimeMs: 600 }),
      skill(ID.ETCHING_DERECHO, 'Etching: Derecho', {
        type: 'Weapon',
        weapon: 'Spear',
        quicknessCastTimeMs: 240
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.deepEqual(
    result.actions.slice(0, 4).map(({ name, timestampMs, inferred }) => ({ name, timestampMs, inferred })),
    [
      { name: 'Etching: Derecho', timestampMs: 0, inferred: true },
      { name: 'Glyph of Storms (Air)', timestampMs: 240, inferred: false },
      { name: 'Flame Barrage', timestampMs: 480, inferred: true },
      { name: 'Derecho', timestampMs: 1_880, inferred: false }
    ]
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Etching: Derecho/);
  assert.match(result.warnings.join('\n'), /Recovered report evidence:.*Flame Barrage/);
});
