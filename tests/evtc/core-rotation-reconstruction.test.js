import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyRotationImportPreview } from '#gw2/app/build/io/rotation-import-dialog.js';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { evtcProfessionMetadata, evtcSpecializationMetadata } from '#gw2/integrations/logs/evtc/profession-metadata.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import {
  EVTC_PROFESSION_ROTATION_PARSERS,
  getEvtcProfessionRotationParser,
  reconstructEvtcRotation
} from '#gw2/integrations/logs/evtc/rotation/index.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event, expandedEvtcFixture, log } from '../helpers/evtc-fixture.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';

const catalog = {
  skills: [
    {
      id: 1_000,
      name: 'Mind Stab',
      type: 'Weapon',
      slot: 'Weapon_2',
      castTimeMs: 800,
      effects: []
    },
    {
      id: 2_000,
      name: 'Time Sink',
      type: 'Profession',
      slot: 'Profession_3',
      castTimeMs: 0,
      effects: [{ type: 'strike', atMs: 0 }]
    },
    {
      id: 3_000,
      name: 'Blink',
      type: 'Utility',
      slot: 'Utility',
      castTimeMs: 500,
      effects: []
    },
    {
      id: -3,
      name: 'Swap Weapons',
      type: 'Action',
      slot: 'Action',
      castTimeMs: 0,
      effects: []
    }
  ]
};

test('modern and legacy EVTC casts obey cancellation contracts across every profession', () => {
  // Keep the same two-input scenario across professions so packet evidence cannot bypass the shared timing contract.
  for (const professionCode of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    for (const modern of [true, false]) {
      for (const { duration = 200, metadata = {}, damagePackets = 0 } of [
        {},
        { duration: 0 },
        { metadata: { interruptCommitMs: 240 } },
        { metadata: { interruptCommitMs: 200 }, damagePackets: 2 },
        { metadata: { effectCommitMs: 200 }, damagePackets: 2 },
        { duration: 199, metadata: { interruptMode: 'per-packet' }, damagePackets: 1 }
      ]) {
        const catalog = createCanonicalCatalog({
          generated: [
            {
              id: 1_000,
              name: 'Fixture Attack',
              type: 'Weapon',
              slot: 'Weapon_2',
              castTimeMs: 520,
              unaffectedByQuickness: true,
              interruptMode: metadata.interruptMode,
              interruptCommitMs: metadata.interruptCommitMs,
              effects: [
                {
                  type: 'strike',
                  ticks: [
                    { atMs: 160, coefficient: 1 },
                    { atMs: 400, coefficient: 1 }
                  ],
                  timingAnchor: 'castStart',
                  interruptCommitMs: metadata.effectCommitMs,
                  persistsAfterInterrupt: metadata.interruptCommitMs != null || metadata.effectCommitMs != null
                }
              ]
            },
            { id: 1_001, name: 'Follow-up', castTimeMs: 520, unaffectedByQuickness: true }
          ]
        });
        const animation = (skillId, start, elapsed) => [
          event({ time: start, skillId, stateChange: modern ? 67 : 0, activation: modern ? 0 : 1, value: 520 }),
          event({ time: start + elapsed, skillId, stateChange: modern ? 68 : 0, activation: 3, value: elapsed })
        ];
        const fixture = log({
          agents: [{ ...log().agents[0], profession: professionCode, elite: 0 }],
          skills: catalog.skills.map(({ id, name }) => ({ id, name })),
          events: [
            ...animation(1_000, 1_000, duration),
            event({ time: 1_160, skillId: 1_000, target: 0x2000n, value: 100 }),
            ...(metadata.interruptMode === 'per-packet'
              ? []
              : [event({ time: 1_400, skillId: 1_000, target: 0x2000n, value: 100 })]),
            ...animation(1_001, 1_000 + duration, 520)
          ].sort((left, right) => left.time - right.time)
        });
        const imported = reconstructEvtcRotation(fixture, catalog, {
          includeCombatStart: false,
          inferInstantCasts: false
        });
        const profession = defineProfession({ id: 'evtc-contract', name: 'EVTC Contract', catalog });
        const replay = createScheduler({ profession }).run(imported.rotation);
        const attempt = replay.steps.find((step) => step.skillId === 1_000);
        const following = replay.steps.find((step) => step.skillId === 1_001);
        const label = `${professionCode}, modern=${modern}, duration=${duration}, ${JSON.stringify(metadata)}`;

        assert.equal(attempt.end - attempt.start, duration, label);
        assert.equal(following.start, duration, label);
        assert.equal(
          replay.events.filter((packet) => packet.type === 'damage' && packet.skillId === 1_000).length,
          damagePackets,
          label
        );
      }
    }
  }
});

test('cancelled EVTC autos preserve the pending Guardian and Necromancer chain step', () => {
  for (const [professionCode, ids, names] of [
    [1, [9137, 9138, 9139], ['Strike', 'Vengeful Strike', 'Wrathful Strike']],
    [8, [29705, 30799, 29867], ['Dusk Strike', 'Fading Twilight', 'Chilling Scythe']]
  ]) {
    const skills = ids.map((id, index) => ({
      id,
      name: names[index],
      type: 'Weapon',
      slot: 'Weapon_1',
      quicknessCastTimeMs: 400,
      effects: [{ type: 'strike', atMs: 160, timingAnchor: 'castStart' }]
    }));
    const fixture = log({
      agents: [{ ...log().agents[0], profession: professionCode, elite: 0 }],
      skills,
      events: [
        [ids[0], 1_000, 400],
        [ids[1], 1_400, 200],
        [ids[1], 1_600, 400]
      ].flatMap(([id, start, duration]) => [
        event({ time: start, skillId: id, stateChange: 67, value: 400 }),
        event({ time: start + 160, skillId: id, target: 0x2000n, value: 100 }),
        event({ time: start + duration, skillId: id, stateChange: 68, value: duration, activation: 3 })
      ])
    });
    const imported = reconstructEvtcRotation(
      fixture,
      { skills },
      { includeCombatStart: false, inferInstantCasts: false }
    );

    assert.deepEqual(imported.rotation, [
      { name: names[0], skillId: ids[0] },
      { name: names[1], skillId: ids[1], interruptMs: 200 },
      { name: names[1], skillId: ids[1] }
    ]);
  }
});

test('canonicalizes Master Tuning Crystal EVTC labels to Tuning Icicle', () => {
  const parsed = parseEvtc(expandedEvtcFixture({ skillName: 'Master Tuning Crystal' }));

  assert.equal(parsed.skills[0].name, 'Tuning Icicle');
});

test('registers an individual parser for every current profession specialization', () => {
  const parserIds = EVTC_PROFESSION_ROTATION_PARSERS.map((parser) => parser.id);
  const expectedIds = new Set(
    ROTATION_PROFILES.map((profile) => `${profile.professionId}:${profile.specializationId}`)
  );

  assert.deepEqual(new Set(parserIds), expectedIds);
  assert.equal(new Set(parserIds).size, parserIds.length);
  assert.equal(getEvtcProfessionRotationParser('mesmer', 'reaper'), null);

  for (const profile of ROTATION_PROFILES) {
    const id = `${profile.professionId}:${profile.specializationId}`;

    assert.equal(getEvtcProfessionRotationParser(profile.professionId, profile.specializationId)?.id, id);
  }

  for (const parser of EVTC_PROFESSION_ROTATION_PARSERS) {
    const profession = Array.from({ length: 256 }, (_, code) => evtcProfessionMetadata(code)).find(
      (candidate) => candidate?.id === parser.professionId
    );
    const specialization = Array.from({ length: 256 }, (_, code) =>
      evtcSpecializationMetadata(code, parser.professionId)
    ).find((candidate) => candidate?.id === parser.specializationId);
    assert.ok(profession, `missing EVTC profession metadata for ${parser.professionId}`);
    assert.ok(specialization, `missing EVTC specialization metadata for ${parser.id}`);
    const fixture = log({
      agents: [
        {
          ...log().agents[0],
          profession: profession.code,
          elite: specialization?.code || 0
        }
      ],
      events: [event({ stateChange: 67, skillId: 1_000 })]
    });

    assert.equal(
      parser.reconstruct(fixture, catalog, {
        inferInstantCasts: false
      }).parserId,
      parser.id
    );
  }
});

test('reconstructs casts, inferred instants, serial weapon swaps, dodges, and 40 ms replay timing', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_200, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_300,
        target: 0x2000n,
        skillId: 2_000,
        value: 100,
        iff: 1
      }),
      event({
        time: 1_301,
        target: 0x2000n,
        skillId: 2_000,
        value: 100,
        iff: 1
      }),
      event({ time: 1_400, stateChange: 11, target: 5n }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 400,
        activation: 3
      }),
      event({ time: 1_700, stateChange: 67, skillId: 65_001 }),
      event({
        time: 2_450,
        stateChange: 68,
        skillId: 65_001,
        value: 750,
        activation: 5
      })
    ]
  });

  fixture.header.eventCount = fixture.events.length;

  const result = reconstructEvtcRotation(fixture, catalog);

  assert.equal(result.parserId, 'mesmer:chronomancer');
  assert.equal(Object.hasOwn(result, 'logStartTime'), false);
  assert.equal(result.combatStartTimestampMs, 0);
  const mindStab = result.actions.find((action) => action.name === 'Mind Stab');
  const timeSink = result.actions.find((action) => action.name === 'Time Sink');
  const weaponSwap = result.actions.find((action) => action.name === 'Swap Weapons');
  const dodge = result.actions.find((action) => action.name === 'Dodge');

  assert.equal(mindStab?.status, 'interrupted');
  assert.equal(timeSink?.timestampMs, 300);
  assert.equal(timeSink?.evidence, 'effect');
  assert.equal(weaponSwap?.weaponSet, 5);
  assert.equal(dodge?.supportedByCatalog, false);
  assert.match(result.warnings[0], /instant cast was inferred/);
  assert.match(result.warnings[1], /not present/);
});

test('does not add EVTC idle time after a weapon-swap-cancelled retained cast', () => {
  const retainedSkill = {
    id: 4_100,
    name: 'Retained Cast',
    type: 'Weapon',
    slot: 'Weapon_2',
    quicknessCastTimeMs: 600,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    effects: []
  };
  const nextSkill = {
    id: 4_101,
    name: 'Next Cast',
    type: 'Weapon',
    slot: 'Weapon_3',
    quicknessCastTimeMs: 400,
    effects: []
  };
  const fixture = log({
    skills: [
      { id: retainedSkill.id, name: retainedSkill.name },
      { id: nextSkill.id, name: nextSkill.name }
    ],
    events: [
      event({ time: 1_200, stateChange: 67, skillId: retainedSkill.id, value: 900 }),
      event({ time: 1_561, stateChange: 68, skillId: retainedSkill.id, value: 361, activation: 4 }),
      event({ time: 1_561, stateChange: 11, target: 5n }),
      event({ time: 1_800, stateChange: 67, skillId: nextSkill.id, value: 600 }),
      event({ time: 2_200, stateChange: 68, skillId: nextSkill.id, value: 400, activation: 3 })
    ]
  });

  const result = reconstructEvtcRotation(
    fixture,
    { skills: [retainedSkill, nextSkill, catalog.skills.at(-1)] },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.deepEqual(result.rotation, [
    { name: 'Retained Cast', skillId: 4_100, interruptMs: 360 },
    { name: 'Swap Weapons', skillId: -3 },
    { name: 'Next Cast', skillId: 4_101 }
  ]);
});

test('preserves cancelled autoattacks and their recorded timeline without artificial waits', () => {
  const autoattack = {
    id: 4_000,
    name: 'Fixture Autoattack',
    type: 'Weapon',
    slot: 'Weapon_1',
    castTimeMs: 840,
    quicknessCastTimeMs: 560,
    effects: []
  };
  const fixture = log({
    skills: [{ id: autoattack.id, name: autoattack.name }],
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_200, stateChange: 67, skillId: autoattack.id, value: 840 }),
      event({ time: 1_600, stateChange: 68, skillId: autoattack.id, value: 400, activation: 3 }),
      event({ time: 1_733, target: 0x2000n, skillId: autoattack.id, value: 100 }),
      event({ time: 1_760, stateChange: 67, skillId: autoattack.id, value: 840 }),
      event({ time: 1_900, stateChange: 68, skillId: autoattack.id, value: 140, activation: 4 }),
      event({ time: 2_000, stateChange: 67, skillId: autoattack.id, value: 840 }),
      event({ time: 2_400, stateChange: 68, skillId: autoattack.id, value: 400, activation: 3 }),
      event({ time: 2_533, target: 0x2000n, skillId: autoattack.id, value: 100 })
    ]
  });

  const result = reconstructEvtcRotation(fixture, { skills: [...catalog.skills, autoattack] });
  const autoattackCommands = result.rotation.filter((command) => command.name === autoattack.name);

  assert.equal(autoattackCommands.length, 3);
  assert.equal(
    autoattackCommands.every((command) => command.offset == null),
    true
  );
  assert.deepEqual(
    autoattackCommands.map(({ interruptMs }) => interruptMs),
    [400, 160, 400]
  );
  assert.deepEqual(
    result.rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
    [200, 160, 80]
  );
});

test('represents observed post-combat idle time with explicit waits', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_200, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_600, stateChange: 68, skillId: 1_000, value: 400, activation: 3 }),
      event({ time: 1_940, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 2_340, stateChange: 68, skillId: 1_000, value: 400, activation: 3 }),
      event({ time: 3_100, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 3_500, stateChange: 68, skillId: 1_000, value: 400, activation: 3 })
    ]
  });

  const result = reconstructEvtcRotation(fixture, catalog);

  assert.deepEqual(
    result.rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
    [200, 360, 760]
  );
});

test('does not promote a cancelled atomic cast to completion merely because its packet landed', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_000,
        stateChange: 68,
        skillId: 1_000,
        activation: 4
      }),
      event({ time: 1_350, target: 0x2000n, skillId: 1_000, value: 100 })
    ]
  });
  const rotationCatalog = {
    skills: [
      {
        ...catalog.skills[0],
        quicknessCastTimeMs: 540,
        effects: [
          {
            type: 'strike',
            atMs: 350,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    includeCombatStart: false,
    inferInstantCasts: false
  });

  assert.match(result.warnings.join('\n'), /no interruptCommitMs cutoff; reconstruction preserves the cancellation/);
  assert.equal(result.actions[0].status, 'interrupted');
  assert.deepEqual(result.rotation, [
    {
      name: 'Mind Stab',
      skillId: 1_000,
      interruptMs: 0
    }
  ]);
});

test('does not infer cast commitment when no effect packet was observed', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_000,
        stateChange: 68,
        skillId: 1_000,
        activation: 4
      }),
      event({ time: 1_350, target: 0x2000n, skillId: 1_000, value: 0 })
    ]
  });
  const rotationCatalog = {
    skills: [
      {
        ...catalog.skills[0],
        quicknessCastTimeMs: 540,
        effects: [
          {
            type: 'strike',
            atMs: 350,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    includeCombatStart: false,
    inferInstantCasts: false
  });

  assert.equal(result.actions[0].status, 'interrupted');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.rotation, [{ name: 'Mind Stab', skillId: 1_000, interruptMs: 0 }]);
});

test('uses rounded EVTC timing when it reaches the engine interrupt cutoff', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_437, stateChange: 68, skillId: 1_000, value: 437, activation: 4 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [{ ...catalog.skills[0], interruptCommitMs: 400 }]
    },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.equal(result.actions[0].durationMs, 437);
  assert.deepEqual(result.rotation, [{ name: 'Mind Stab', skillId: 1_000, interruptMs: 440 }]);
  assert.deepEqual(result.warnings, []);
});

test('replays a completed cast only through its committed aftercast boundary', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_400, target: 0x2000n, skillId: 1_000, value: 100 }),
      event({ time: 1_437, stateChange: 68, skillId: 1_000, value: 437, activation: 3 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          ...catalog.skills[0],
          quicknessCastTimeMs: 800,
          interruptCommitMs: 400,
          effects: [{ type: 'strike', atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }]
        }
      ]
    },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.equal(result.actions[0].status, 'reduced');
  assert.deepEqual(result.rotation, [{ name: 'Mind Stab', skillId: 1_000, interruptMs: 440 }]);
});

test('right-aligns damage-inferred ammo flips within an active cast', () => {
  const fixture = log({
    skills: [...log().skills, { id: 4_000, name: 'Ammo Flip' }],
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_300, target: 0x2000n, skillId: 4_000, value: 100 }),
      event({
        time: 1_800,
        stateChange: 68,
        skillId: 1_000,
        value: 800,
        activation: 3
      }),
      event({ time: 2_200, stateChange: 67, skillId: 3_000, value: 500 }),
      event({
        time: 2_700,
        stateChange: 68,
        skillId: 3_000,
        value: 500,
        activation: 3
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      ...catalog.skills,
      {
        id: 4_000,
        name: 'Ammo Flip',
        type: 'Utility',
        slot: 'Utility',
        castTimeMs: 0,
        ammo: 2,
        flipParentId: 4_001,
        canCastConcurrently: true,
        effects: [{ type: 'strike', atMs: 0 }]
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    includeCombatStart: false
  });
  const ammoFlip = result.actions.find((action) => action.name === 'Ammo Flip');

  assert.equal(ammoFlip.timestampMs, 700);
});

test('pairs a stop before the next same-millisecond animation start', () => {
  const fixture = log({
    events: [
      event({
        time: 1_000,
        stateChange: 68,
        skillId: 2_000,
        value: 500,
        activation: 3
      }),
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3
      }),
      event({ time: 1_600, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 2_200,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, catalog, {
    includeCombatStart: false,
    inferInstantCasts: false
  });

  assert.deepEqual(
    result.actions.map((action) => ({
      timestampMs: action.timestampMs,
      durationMs: action.durationMs
    })),
    [
      { timestampMs: 0, durationMs: 600 },
      { timestampMs: 600, durationMs: 600 }
    ]
  );
  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait'),
    [
      { name: 'Mind Stab', skillId: 1_000 },
      { name: 'Mind Stab', skillId: 1_000 }
    ]
  );
});

test('keeps an instant at the preceding cast end sequential', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3
      }),
      event({
        time: 1_600,
        target: 0x2000n,
        skillId: 2_000,
        value: 100
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, catalog, {
    includeCombatStart: false
  });

  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait'),
    [
      { name: 'Mind Stab', skillId: 1_000 },
      { name: 'Time Sink', skillId: 2_000 }
    ]
  );
});

test('resolves Weaponmaster skills owned by another specialization', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 45_846, name: 'Harrowing Wave' }],
    events: [event({ stateChange: 67, skillId: 45_846 })]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 45_846,
        name: 'Harrowing Wave',
        type: 'Weapon',
        slot: 'Weapon_4',
        specialization: 'Scourge',
        castTimeMs: 650,
        effects: []
      }
    ]
  });

  assert.equal(result.actions[0].skillId, 45_846);
  assert.equal(result.actions[0].supportedByCatalog, true);
});

test('reconstructs Harbinger Shroud entry and exit from buff transitions', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 59_964, name: 'Harbinger Shroud' }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        value: 10_000,
        skillId: 59_964,
        buff: 1
      }),
      event({ time: 1_000, target: 4n, stateChange: 11 }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 59_964,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 59_964,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({ time: 3_000, target: 5n, stateChange: 11 })
    ]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 62_567,
        name: 'Harbinger Shroud',
        type: 'Profession',
        slot: 'Profession_1',
        specialization: 'Harbinger',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 62_540,
        name: 'Exit Harbinger Shroud',
        type: 'Profession',
        slot: 'Profession_1',
        specialization: 'Harbinger',
        castTimeMs: 0,
        effects: []
      },
      catalog.skills.at(-1)
    ]
  });

  assert.deepEqual(
    result.actions.map((action) => ({
      name: action.name,
      skillId: action.skillId,
      evidence: action.evidence
    })),
    [
      {
        name: 'Harbinger Shroud',
        skillId: 62_567,
        evidence: 'buff-transition'
      },
      {
        name: 'Exit Harbinger Shroud',
        skillId: 62_540,
        evidence: 'buff-transition'
      }
    ]
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Swap Weapons'),
    false
  );
});

test('reconstructs a Soul Barbs shroud precast', () => {
  const initialBuff = (skillId) =>
    event({
      time: 1_000,
      target: PLAYER,
      skillId,
      buff: 1,
      stateChange: 18
    });
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 45_846, name: 'Harrowing Wave' }],
    events: [
      initialBuff(53_489),
      event({ time: 10_000, stateChange: 1 }),
      event({ time: 10_000, stateChange: 67, skillId: 45_846 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        [62_567, 'Harbinger Shroud', 'Profession'],
        [62_540, 'Exit Harbinger Shroud', 'Profession'],
        [45_846, 'Harrowing Wave', 'Weapon']
      ].map(([id, name, type]) => ({
        id,
        name,
        type,
        slot: type === 'Profession' ? 'Profession_1' : 'Weapon_4',
        specialization: type === 'Profession' ? 'Harbinger' : 'Scourge',
        castTimeMs: 0,
        effects: []
      }))
    },
    { inferInstantCasts: false }
  );

  assert.deepEqual(result.rotation, [
    { name: 'Harbinger Shroud', skillId: 62_567 },
    { name: 'Exit Harbinger Shroud', skillId: 62_540 },
    { name: '__wait', waitMs: 9_000 },
    { name: '__combat_start' },
    { name: 'Harrowing Wave', skillId: 45_846 }
  ]);
});

test('applying a rotation import preserves configured starting resources', () => {
  const changedCalls = [];
  const app = {
    build: { rotation: [], initialBlight: 7 },
    changed(...args) {
      changedCalls.push(args);
    }
  };

  applyRotationImportPreview(app, {
    rotation: [{ type: 'cast', skillId: 62_567 }],
    actionCount: 1,
    description: 'Fixture Harbinger',
    warnings: [],
    observations: []
  });

  assert.deepEqual(app.build.rotation, [{ type: 'cast', skillId: 62_567 }]);
  assert.equal(app.build.initialBlight, 7);
  assert.deepEqual(changedCalls, [[false]]);
});

test('reconstructs Plague Signet once per passive-buff removal', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 72_368, name: 'Plague Signet' }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 10_562,
          name: 'Plague Signet',
          type: 'Utility',
          slot: 'Utility_2',
          castTimeMs: 0,
          effects: []
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.deepEqual(
    result.actions.map((action) => ({
      timestampMs: action.timestampMs,
      name: action.name,
      skillId: action.skillId,
      evidence: action.evidence
    })),
    [
      {
        timestampMs: 0,
        name: 'Plague Signet',
        skillId: 10_562,
        evidence: 'buff-transition'
      },
      {
        timestampMs: 2_000,
        name: 'Plague Signet',
        skillId: 10_562,
        evidence: 'buff-transition'
      }
    ]
  );
});

test('places Plague Signet after the observed Blood Is Power interruption', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [
      { id: 10_544, name: 'Blood Is Power' },
      { id: 72_368, name: 'Plague Signet' }
    ],
    events: [
      event({ time: 1_000, skillId: 10_544, value: 1_320, stateChange: 67 }),
      event({
        time: 1_500,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 1_600,
        skillId: 10_544,
        value: 600,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 10_544,
          name: 'Blood Is Power',
          type: 'Utility',
          slot: 'Utility_1',
          castTimeMs: 880,
          quicknessCastTimeMs: 880,
          retainsCastLockoutAfterInterrupt: true,
          effects: []
        },
        {
          id: 10_562,
          name: 'Plague Signet',
          type: 'Utility',
          slot: 'Utility_2',
          castTimeMs: 0,
          effects: []
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.deepEqual(
    result.actions.map((action) => ({
      name: action.name,
      timestampMs: action.timestampMs,
      durationMs: action.durationMs
    })),
    [
      { name: 'Blood Is Power', timestampMs: 0, durationMs: 600 },
      { name: 'Plague Signet', timestampMs: 600, durationMs: 0 }
    ]
  );
  assert.deepEqual(result.rotation, [
    { name: 'Blood Is Power', skillId: 10_544, interruptMs: 600 },
    { name: 'Plague Signet', skillId: 10_562, offset: 600 }
  ]);
  assert.deepEqual(result.warnings, []);
});

test('preserves cancellation when EVTC timing is below the commit cutoff', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 62_672, name: 'Devouring Cut' }],
    events: [
      event({ time: 1_000, skillId: 62_672, value: 1_040, stateChange: 67 }),
      event({
        time: 1_360,
        skillId: 62_672,
        value: 360,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 1_360, target: 0x2000n, skillId: 62_672, value: 100 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 62_672,
          name: 'Devouring Cut',
          type: 'Profession',
          slot: 'Weapon_3',
          quicknessCastTimeMs: 480,
          interruptCommitMs: 400,
          effects: [
            {
              type: 'strike',
              coefficient: 1,
              hits: 1,
              atMs: 360,
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            }
          ]
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.equal(result.actions[0].durationMs, 360);
  assert.deepEqual(result.rotation, [{ name: 'Devouring Cut', skillId: 62_672, interruptMs: 360 }]);
  assert.deepEqual(result.warnings, []);
});

test('preserves EVTC interruptions both at and below the commit frame', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [
      { id: 62_621, name: 'Dark Barrage' },
      { id: 10_706, name: 'Enfeebling Blood' }
    ],
    events: [
      event({ time: 1_000, skillId: 62_621, value: 1_240, stateChange: 67 }),
      event({
        time: 1_794,
        skillId: 62_621,
        value: 794,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 2_500, skillId: 10_706, value: 1_200, stateChange: 67 }),
      event({
        time: 3_099,
        skillId: 10_706,
        value: 599,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 62_621,
          name: 'Dark Barrage',
          type: 'Profession',
          slot: 'Weapon_2',
          quicknessCastTimeMs: 920,
          interruptCommitMs: 800,
          effects: []
        },
        {
          id: 10_706,
          name: 'Enfeebling Blood',
          type: 'Weapon',
          slot: 'Weapon_2',
          quicknessCastTimeMs: 840,
          interruptCommitMs: 638,
          effects: []
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait'),
    [
      { name: 'Dark Barrage', skillId: 62_621, interruptMs: 800 },
      { name: 'Enfeebling Blood', skillId: 10_706, interruptMs: 600 }
    ]
  );
  assert.deepEqual(result.warnings, []);
});

test('reconstructs Distress from its consumed availability buff', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 72_976, name: 'Distress' }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        value: 3_000,
        skillId: 72_976,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 1_800,
        target: PLAYER,
        value: 2_200,
        skillId: 72_976,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 1_800,
        target: PLAYER,
        value: 2_200,
        buffDamage: 2_200,
        skillId: 72_976,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({
        time: 4_000,
        target: PLAYER,
        value: 3_000,
        skillId: 72_976,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 7_000,
        target: PLAYER,
        skillId: 72_976,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 73_116,
        name: 'Distress',
        type: 'Weapon',
        slot: 'Weapon_4',
        castTimeMs: 0,
        effects: []
      }
    ]
  });

  assert.deepEqual(
    result.actions.map((action) => [action.name, action.skillId, action.evidence]),
    [['Distress', 73_116, 'buff-transition']]
  );
});
