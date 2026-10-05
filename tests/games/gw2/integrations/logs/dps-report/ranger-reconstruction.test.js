import assert from 'node:assert/strict';
import test from 'node:test';

import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';

// Fixtures retain only the Ranger signals needed to prove each report correction.
function reportFixture(profession, rotation, skillMap, options = {}) {
  const start = options.start ?? 0;
  const end = options.end ?? 10_000;
  return parseDpsReport({
    ...(options.damage ? { targets: [{}] } : {}),
    players: [
      {
        name: `Fixture ${profession}`,
        profession,
        rotation,
        ...(options.minions ? { minions: options.minions } : {}),
        ...(options.damage ? { targetDamageDist: [[options.damage]] } : {})
      }
    ],
    phases: [{ start, end, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap
  });
}

test('Untamed prefers pet F1/F2/F3 animations while Soulbeast retains the player rotation', () => {
  const rotation = [
    { id: 63335, skills: [{ castTime: 0, duration: 480 }] },
    { id: 31451, skills: [{ castTime: 50, duration: 0 }] }
  ];
  const skillMap = {
    s63335: { name: 'Unleashed Wild Swing' },
    s31451: { name: 'Furious Pounce' },
    s12694: { name: 'Bite' },
    s12657: { name: 'Maul' },
    s12655: { name: 'Slash', autoAttack: true }
  };
  const minions = [
    {
      name: 'Juvenile Tiger',
      rotation: [
        { id: 12694, skills: [{ castTime: 100, duration: 1200 }] },
        { id: 12657, skills: [{ castTime: 1500, duration: 1200 }] },
        { id: 12655, skills: [{ castTime: 3000, duration: 1200 }] },
        { id: 31451, skills: [{ castTime: 500, duration: 1200 }] }
      ]
    }
  ];
  for (const specialization of ['Untamed', 'Soulbeast']) {
    const report = reportFixture(specialization, rotation, skillMap, { minions });
    const result = reconstructDpsReportRotation(report, rangerCatalog);
    const casts = result.rotation.filter((command) => command.type === 'cast');
    assert.deepEqual(
      casts.map((command) => command.skillId),
      specialization === 'Untamed' ? [63335, 12694, 31451, 12657] : [63335, 31451]
    );
    if (specialization === 'Untamed') {
      assert.deepEqual(
        result.sourceActions.map((action) => action.startMs),
        [0, 100, 500, 1500]
      );
      assert.ok(casts.slice(1).every((command) => command.concurrentOffsetMs != null));
    } else {
      assert.equal(result.sourceActions.find((action) => action.rawSkillId === 31451).startMs, 50);
    }
  }
});

test('Untamed EVTC F2 uses owned pet animations instead of delayed command markers', () => {
  // Both encodings identify the pet's actual start; another owner's pet cannot replace the selected player's cast.
  for (const modern of [false, true]) {
    for (const elite of [72, 55]) {
      const player = { ...log().agents[0], profession: 4, elite };
      const pet = { ...player, address: 0x2000n, profession: 15380, elite: 0xffffffff };
      const foreignPet = { ...pet, address: 0x3000n };
      const cast = (source, time, stop = false) =>
        event({
          source,
          time,
          sourceInstance: source === pet.address ? 2 : 3,
          sourceMasterInstance: source === pet.address ? 1 : 0,
          skillId: 31451,
          value: 1200,
          stateChange: modern ? (stop ? 68 : 67) : 0,
          activation: stop ? 5 : modern ? 0 : 1
        });
      const fixture = log({
        header: { ...log().header, arcdpsBuild: modern ? '20260815' : '20240401' },
        agents: [player, pet, foreignPet],
        skills: [{ id: 31451, name: 'Furious Pounce' }],
        events: [
          event({ time: 0, stateChange: 1 }),
          cast(foreignPet.address, 100),
          cast(pet.address, 1000),
          cast(foreignPet.address, 1300, true),
          event({
            time: 1480,
            source: pet.address,
            target: pet.address,
            sourceInstance: 2,
            sourceMasterInstance: 1,
            skillId: 59536,
            value: 1000,
            buff: 1,
            stateChange: modern ? 69 : 0
          }),
          cast(pet.address, 2200, true)
        ]
      });
      const result = reconstructEvtcRotation(fixture, rangerCatalog);
      const actions = result.sourceActions.filter((action) => action.rawSkillId === 31451);

      assert.equal(actions.length, 1);
      assert.equal(actions[0].startMs, elite === 72 ? 1000 : 1480);
      assert.equal(result.rotation.filter((command) => command.skillId === 31451).length, 1);
    }
  }
});

test('Untamed pet casts respect player selection and phase intersection', () => {
  const report = reportFixture(
    'Untamed',
    [{ id: 63147, skills: [{ castTime: 1000, duration: 0 }] }],
    {
      s63147: { name: 'Unleash Ranger' },
      s12694: { name: 'Bite' }
    },
    {
      start: 1000,
      end: 2000,
      minions: [
        {
          name: 'Juvenile Tiger',
          rotation: [
            {
              id: 12694,
              skills: [
                { castTime: 0, duration: 100 },
                { castTime: 900, duration: 300 },
                { castTime: 2000, duration: 300 }
              ]
            }
          ]
        }
      ]
    }
  );
  const secondPlayer = { ...report.players[0], name: 'Other player', minions: [] };
  const selected = reconstructDpsReportRotation(
    { ...report, players: [secondPlayer, ...report.players] },
    rangerCatalog,
    { playerIndex: 1 }
  );
  assert.deepEqual(
    selected.sourceActions.filter((action) => action.rawSkillId === 12694).map((action) => action.startMs),
    [900]
  );
  const other = reconstructDpsReportRotation({ ...report, players: [secondPlayer, ...report.players] }, rangerCatalog, {
    playerIndex: 0
  });
  assert.equal(
    other.sourceActions.some((action) => action.rawSkillId === 12694),
    false
  );
});

test('report validation rejects malformed pet rotation data before reconstruction', () => {
  for (const minions of [
    {},
    [{ name: 'Juvenile Tiger', rotation: {} }],
    [{ name: 'Juvenile Tiger', rotation: [{ id: 12694, skills: [{ castTime: 'invalid', duration: 100 }] }] }]
  ]) {
    assert.throws(() => reportFixture('Untamed', [], {}, { minions }), /invalid/i);
  }

  assert.doesNotThrow(() => reportFixture('Untamed', [], {}, { minions: [{ name: 'Juvenile Tiger' }] }));
});

test('merges Untamed smash rows and removes the simulator-owned Lesser Sic Em proc', () => {
  const report = reportFixture(
    'Untamed',
    [
      { id: 63197, skills: [{ castTime: 0, duration: 250, timeGained: 710 }] },
      { id: 63224, skills: [{ castTime: 250, duration: 30, timeGained: -1 }] },
      { id: 79348, skills: [{ castTime: 400, duration: 0, timeGained: 0 }] }
    ],
    {
      s63197: { name: 'Unleashed Overbearing Smash' },
      s63224: { name: 'Unleashed Overbearing Smash (Leap)' },
      s79348: { name: 'Lesser Sic Em' }
    }
  );

  const result = reconstructDpsReportRotation(report, rangerCatalog);
  const smashes = result.actions.filter((action) => action.name === 'Unleashed Overbearing Smash');

  assert.equal(smashes.length, 1);
  assert.equal(smashes[0].status, 'interrupted');
  assert.equal(
    result.actions.some((action) => action.rawSkillId === 79348),
    false
  );
  assert.equal(
    result.actions.every((action) => action.supportedByCatalog),
    true
  );
});

test('normalizes Galeshot swap, pet, and automatic report signals', () => {
  const report = reportFixture(
    'Galeshot',
    [
      { id: 76787, skills: [{ castTime: 0, duration: 0, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 1, duration: 0, timeGained: 0 }] },
      { id: 77319, skills: [{ castTime: 10, duration: 680, timeGained: 0 }] },
      { id: 77213, skills: [{ castTime: 700, duration: 0, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 701, duration: 0, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 1000, duration: 0, timeGained: 0 }] },
      { id: -28, skills: [{ castTime: 1100, duration: 0, timeGained: 0 }] },
      { id: 76905, skills: [{ castTime: 1200, duration: 0, timeGained: 0 }] },
      { id: 12703, skills: [{ castTime: 1300, duration: 333, timeGained: 0 }] },
      { id: 41156, skills: [{ castTime: 1700, duration: 1000, timeGained: 0 }] }
    ],
    {
      s76787: { name: 'Summon Cyclone Bow', isInstantCast: true },
      's-2': { name: 'Weapon Swap', isSwap: true, isInstantCast: true },
      s77319: { name: 'Bluster' },
      s77213: { name: 'Dismiss Cyclone Bow', isInstantCast: true },
      's-28': { name: 'Ranger Pet Spawned', isInstantCast: true },
      s76905: { name: 'Wuthering Wind', isInstantCast: true },
      s12703: { name: 'Regenerate' },
      s41156: { name: 'Fang Grapple' }
    },
    { damage: [{ id: 77319, connectedHits: 3 }] }
  );

  const result = reconstructDpsReportRotation(report, rangerCatalog);

  assert.equal(result.actions.filter((action) => action.name === 'Swap Weapons').length, 1);
  assert.equal(result.actions.filter((action) => action.name === 'Swap Pets').length, 1);
  assert.equal(
    result.actions.some((action) => [76905, 12703, 41156].includes(action.rawSkillId)),
    false
  );
  assert.equal(
    result.actions.every((action) => action.supportedByCatalog),
    true
  );
});

test('both log adapters merge a spear follow-through without inventing another input', () => {
  // Two animations belong to one attack; use a minimal source sequence rather than a saved-log shape assertion.
  const rows = [
    { id: 73030, skills: [{ castTime: 0, duration: 750, timeGained: 0 }] },
    { id: 73043, skills: [{ castTime: 750, duration: 250, timeGained: 0 }] },
    { id: 73043, skills: [{ castTime: 2000, duration: 250, timeGained: 0 }] }
  ];
  const skills = { s73030: { name: "Wolf's Onslaught" }, s73043: { name: "Wolf's Onslaught" } };
  const report = reportFixture('Soulbeast', rows, skills);
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 4, elite: 55 }],
    skills: [
      { id: 73030, name: "Wolf's Onslaught" },
      { id: 73043, name: "Wolf's Onslaught" }
    ],
    events: rows.flatMap(({ id, skills: casts }) =>
      casts.flatMap(({ castTime, duration }) => [
        event({ time: castTime, stateChange: 67, skillId: id, value: duration }),
        event({ time: castTime + duration, stateChange: 68, skillId: id, value: duration, activation: 5 })
      ])
    )
  });
  for (const result of [
    reconstructDpsReportRotation(report, rangerCatalog),
    reconstructEvtcRotation(fixture, rangerCatalog)
  ]) {
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].skillId, 73030);
    assert.equal(result.rotation.filter((command) => command.skillId === 73030).length, 1);
  }
});
