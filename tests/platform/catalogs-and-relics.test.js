import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createGw2ResolverExtensions } from '#gw2/platform/resolver/extensions.js';
import { createRelicRuntime, createRelicTimelineRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { handleWeaknessVulnerabilityRelic } from '#gw2/platform/resolver/relic-reactions.js';
import { materializeBoonRelics } from '#gw2/platform/scheduler/relic-materializer.js';
import {
  relicConditionDurationBonus,
  relicOutgoingDamageBonus,
  relicStrikeMultiplier,
  recordPassiveRelicTimeline
} from '#gw2/platform/equipment/relics/query.js';
import { sigilCriticalContribution } from '#gw2/platform/equipment/sigils/rules.js';
import {
  FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
  PRECISION_PER_CRITICAL_CHANCE_FRACTION
} from '#gw2/platform/combat/damage/stat-scaling.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { createDefaultConfig, simulateMesmer } from '../helpers/mesmer-simulation.js';

test('Mesmer production simulation is reached through simulateGw2', () => {
  const config = {
    ...createDefaultConfig(),
    target: {
      ...createDefaultConfig().target,
      health: 0
    }
  };
  const canonical = simulateGw2({
    profession: mesmerProfession,
    rotation: ['Bladecall'],
    config
  });
  const compatibility = simulateMesmer(['Bladecall'], config);

  assert.equal(canonical.totalDamage, compatibility.totalDamage);
  assert.equal(canonical.strikeDamage, compatibility.strikeDamage);
  assert.equal(canonical.conditionDamage, compatibility.conditionDamage);
  assert.ok(canonical.totalDamage > 0);
  assert.deepEqual(
    Object.keys(canonical.endState).sort(),
    ['activeWeaponSet', 'ammo', 'ammoBySkillId', 'cooldowns', 'profession', 'time'].sort()
  );
  assert.equal(canonical.endState.profession.resource, 5);
});

test('canonical catalog validation rejects duplicate ids and missing handlers', () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          { id: 1, name: 'One', effects: [] },
          { id: 1, name: 'Two', effects: [] }
        ]
      }),
    /Duplicate/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [{ id: 1, name: 'One', handlerId: 'missing', effects: [] }]
      }),
    /missing handler/
  );
  assert.equal(mesmerCatalog.skillsById.size, mesmerCatalog.skills.length);
  const lastNameWins = createCanonicalCatalog({
    generated: [
      { id: 1, name: 'Variant', effects: [] },
      { id: 2, name: 'Variant', effects: [] }
    ],
    skillNameCollision: 'last'
  });

  assert.equal(lastNameWins.skillsByName.get('Variant').id, 2);
  assert.throws(() => createCanonicalCatalog({ skillNameCollision: 'invalid' }), /collision policy/);
});

test('canonical catalogs carry validated traits and specializations', () => {
  const catalog = createCanonicalCatalog({
    traits: [{ id: 1, name: 'Fixture Trait' }],
    specializations: [{ id: 2, name: 'Fixture Line' }]
  });

  assert.equal(catalog.traits[0].name, 'Fixture Trait');
  assert.equal(catalog.specializations[0].name, 'Fixture Line');
  assert.throws(
    () =>
      createCanonicalCatalog({
        traits: [
          { id: 1, name: 'One' },
          { id: 1, name: 'Two' }
        ]
      }),
    /Duplicate or missing trait/
  );
});

test('canonical catalogs validate and freeze skill-group lockouts', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930030,
        name: 'Lockout Fixture',
        lockouts: [{ group: 'fixture.family', durationMs: 50 }],
        effects: []
      }
    ]
  });
  const skill = catalog.skillsById.get(930030);

  assert.deepEqual(skill.lockouts, [
    {
      group: 'fixture.family',
      durationMs: 50
    }
  ]);
  assert.equal(Object.isFrozen(skill.lockouts), true);
  assert.equal(Object.isFrozen(skill.lockouts[0]), true);

  for (const lockouts of [
    {},
    [{}],
    [{ group: '', durationMs: 50 }],
    [{ group: 'fixture.family', durationMs: 0 }],
    [
      { group: 'fixture.family', durationMs: 50 },
      { group: 'fixture.family', durationMs: 100 }
    ]
  ]) {
    assert.throws(
      () =>
        createCanonicalCatalog({
          generated: [
            {
              id: 930031,
              name: 'Invalid Lockout Fixture',
              lockouts,
              effects: []
            }
          ]
        }),
      /lockout/i
    );
  }
});

test('catalog skill handlers receive calculated recharge timing', () => {
  let observedReadyAt = null;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930014,
        name: 'Timed Handler',
        cooldown: 20,
        castTimeMs: 1000,
        handlerId: 'fixture.timed',
        effects: []
      }
    ],
    skillHandlers: {
      'fixture.timed': replaceSkillHandler((context) => {
        observedReadyAt = context.rechargeReadyAt;
      })
    }
  });
  const profession = defineProfession({
    id: 'timed-handler-fixture',
    name: 'Timed Handler Fixture',
    catalog
  });

  simulateGw2({
    profession,
    rotation: ['Timed Handler'],
    config: { boons: { alacrity: true } }
  });
  assert.equal(observedReadyAt, 17);
});

test('summon-owned cooldowns require Alacrity applied to summons', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930041,
        name: 'Summon Skill',
        cooldown: 20,
        castTimeMs: 0,
        rechargeBuffAudience: 'summon',
        effects: []
      },
      {
        id: 930042,
        name: 'Grant Summon Alacrity',
        castTimeMs: 0,
        effects: [
          {
            type: 'buff',
            kind: 'alacrity',
            duration: 10,
            audience: {
              recipients: 'summons',
              eligibleCompanionIds: ['fixture-summon']
            }
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'summon-alacrity-fixture',
    name: 'Summon Alacrity Fixture',
    catalog
  });
  const playerAlacrity = simulateGw2({
    profession,
    rotation: ['Summon Skill'],
    config: { boons: { alacrity: true } }
  });
  const summonAlacrity = simulateGw2({
    profession,
    rotation: ['Grant Summon Alacrity', 'Summon Skill'],
    config: { boons: { alacrity: true } }
  });

  assert.equal(playerAlacrity.endState.cooldowns['Summon Skill'].readyAt, 20000);
  assert.equal(summonAlacrity.endState.cooldowns['Summon Skill'].readyAt, 16000);
});

test('canonical augmenting skill handlers observe declarative effects', () => {
  let handled = 0;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930003,
        name: 'Handled Skill',
        type: 'Utility',
        handlerId: 'fixture.handled',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 10 }]
      }
    ],
    skillHandlers: {
      'fixture.handled': augmentSkillHandler(null, {
        afterEffect: (_context, _skill, event) => {
          assert.equal(event.coefficient, 10);
          handled += 1;
        }
      })
    }
  });
  const profession = defineProfession({
    id: 'handled-fixture',
    name: 'Handled Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Handled Skill']
  });

  assert.equal(handled, 1);
  assert.ok(result.totalDamage > 0);
});

test('replacing skill handlers retain effects metadata without declarative double emission', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930032,
        name: 'Replacing Skill',
        handlerId: 'fixture.replacing',
        castTimeMs: 0,
        effects: [{ type: 'strike', flatDamage: 10 }]
      }
    ],
    skillHandlers: {
      'fixture.replacing': replaceSkillHandler((context, skill) => {
        context.emit({
          type: 'damage',
          at: context.start,
          source: 'fixture',
          sourceId: skill.id,
          actorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          name: skill.name,
          flatDamage: 1,
          hits: 1,
          canCrit: false
        });
      })
    }
  });
  const profession = defineProfession({
    id: 'replacing-fixture',
    name: 'Replacing Fixture',
    catalog
  });
  const result = simulateGw2({ profession, rotation: ['Replacing Skill'] });
  const packets = result.events.filter((event) => event.type === 'damage' && event.skillId === 930032);

  assert.equal(catalog.skillsById.get(930032).effects.length, 1);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].flatDamage, 1);
});

test('the shared handler contract rejects undeclared strategy fields', () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930036,
            name: 'Drifting Handler',
            handlerId: 'fixture.drifting-handler',
            castTimeMs: 0,
            effects: []
          }
        ],
        skillHandlers: {
          'fixture.drifting-handler': {
            mode: 'replace',
            beforeEffects: () => {},
            necromancerState: true
          }
        }
      }),
    /unsupported field.*necromancerState/
  );
});

test('the shared effect contract rejects undeclared simulation fields', () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930033,
            name: 'Drifting Effect',
            effects: [
              {
                type: 'strike',
                coefficient: 1,
                necromancerOnlyCoefficient: 2
              }
            ]
          }
        ]
      }),
    /unsupported field.*necromancerOnlyCoefficient/
  );
});

test('the shared effect contract rejects recipient fields nested in metadata', () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930043,
            name: 'Nested Recipients',
            effects: [
              {
                type: 'buff',
                kind: 'might',
                duration: 1,
                metadata: { recipients: 'party', maximumRecipients: 5 }
              }
            ]
          }
        ]
      }),
    /unsupported fields: recipients, maximumRecipients/
  );
});

test('target-health coefficient modifiers are shared and resolve per hit', () => {
  const thresholdModifier = Object.freeze([
    {
      kind: 'target-health-below',
      threshold: 0.5,
      multiplier: 2
    }
  ]);
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930034,
        name: 'Opening Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      },
      {
        id: 930035,
        name: 'Threshold Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [
          {
            type: 'strike',
            coefficient: 1,
            coefficientModifiers: thresholdModifier
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'threshold-fixture',
    name: 'Threshold Fixture',
    catalog
  });
  const opening = simulateGw2({
    profession,
    rotation: ['Opening Strike']
  });
  const openingDamage = opening.resolvedEvents.find((event) => event.type === 'damage')?.damage;
  const result = simulateGw2({
    profession,
    rotation: ['Opening Strike', 'Threshold Strike'],
    config: {
      target: {
        health: openingDamage * 1.5,
        armor: 2597
      }
    }
  });
  const thresholdDamage = result.resolvedEvents.find((event) => event.skillId === 930035)?.damage;
  const startingBelowHalf = simulateGw2({
    profession,
    rotation: ['Threshold Strike'],
    config: {
      target: {
        health: openingDamage * 10,
        startingHealthFraction: 0.49,
        armor: 2597
      }
    }
  });
  const startingBelowHalfDamage = startingBelowHalf.resolvedEvents.find((event) => event.skillId === 930035)?.damage;

  assert.ok(Math.abs(thresholdDamage / openingDamage - 2) < 1e-12);
  assert.ok(Math.abs(startingBelowHalfDamage / openingDamage - 2) < 1e-12);
});

test('the handler strategy contract accepts canonical Mesmer skill data', () => {
  const source = mesmerCatalog.skillsByName.get('Mind Stab');
  let observed = 0;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        ...source,
        handlerId: 'mesmer.fixture-augment'
      }
    ],
    skillHandlers: {
      'mesmer.fixture-augment': augmentSkillHandler(null, {
        afterEffect: () => {
          observed += 1;
        }
      })
    }
  });
  const profession = defineProfession({
    id: 'mesmer-handler-fixture',
    name: 'Mesmer Handler Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Mind Stab']
  });

  assert.equal(observed, source.effects.length);
  assert.ok(result.totalDamage > 0);
});

test('shared relic behavior resolves triggering skills by stable id', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930004,
        name: 'Duplicate Name',
        type: 'Weapon',
        weapon: 'Sword',
        cooldown: 20,
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      },
      {
        id: 930005,
        name: 'Duplicate Name',
        type: 'Weapon',
        weapon: 'Sword',
        cooldown: 0,
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'stable-id-fixture',
    name: 'Stable ID Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'cast', skillId: 930004 }],
    config: { relic: 'Fireworks' }
  });

  assert.equal(
    result.procSteps.some((step) => step.skill === 'Relic of Fireworks'),
    true
  );
});

test('resolver extensions create isolated state only for the selected relic', () => {
  const createRuntime = (relic) =>
    createGw2ResolverExtensions({ config: { relic } }).createEquipmentState({
      relic
    });
  const thief = createRuntime('Thief');
  const anotherThief = createRuntime('Thief');
  const brawler = createRuntime('Brawler');
  const aristocracy = createRuntime('Aristocracy');

  assert.equal(thief.relic.name, 'Thief');
  assert.deepEqual(thief.relic.state, { stacks: 0, expiresAt: 0 });
  assert.deepEqual(brawler.relic.state, { readyAt: 0, buffUntil: 0 });
  assert.deepEqual(aristocracy.relic.state, {
    readyAt: 0,
    stacks: 0,
    expiresAt: 0,
    activations: []
  });
  assert.notEqual(thief.relic.state, anotherThief.relic.state);

  thief.relic.state.stacks = 3;
  assert.equal(anotherThief.relic.state.stacks, 0);
});

test('Severance critical contributions are data-driven and expire exactly', () => {
  assert.deepEqual(sigilCriticalContribution(null, 0), {
    chance: 0,
    damage: 0,
    chanceContributors: []
  });
  const runtime = { sigil: { severanceUntil: 4 } };

  assert.deepEqual(sigilCriticalContribution(runtime, 3.999), {
    chance: 250 / PRECISION_PER_CRITICAL_CHANCE_FRACTION,
    damage: 250 / FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
    chanceContributors: [
      {
        id: 'sigil-severance',
        label: 'Sigil of Severance',
        amount: 250 / PRECISION_PER_CRITICAL_CHANCE_FRACTION
      }
    ]
  });
  assert.deepEqual(sigilCriticalContribution(runtime, 4), {
    chance: 0,
    damage: 0,
    chanceContributors: []
  });
});

test('Aristocracy rule state owns strict ICD, stack cap, and expiry', () => {
  const relic = createRelicRuntime('Aristocracy');
  const context = { relic };
  const trigger = (at) =>
    handleWeaknessVulnerabilityRelic(context, {
      type: 'weakness_vulnerability',
      at,
      skillName: `Trigger ${at}`
    });

  trigger(0);
  assert.equal(relicConditionDurationBonus(context, 0), 0);
  assert.equal(relicConditionDurationBonus(context, 0.001), 0.03);
  trigger(1);
  assert.equal(relic.state.stacks, 1);
  for (const at of [1.001, 2.002, 3.003, 4.004, 5.005]) trigger(at);
  assert.equal(relic.state.stacks, 5);
  assert.equal(relicConditionDurationBonus(context, 5.006), 0.15);
  assert.equal(relicConditionDurationBonus(context, 13.005), 0);
});

test('Aristocracy historical queries preserve combat and timestamp boundaries', () => {
  const events = [
    { type: 'weakness_vulnerability', at: 1.001, skillName: 'Second' },
    { type: 'weakness_vulnerability', at: -1, skillName: 'Precombat' },
    { type: 'combat_start', at: 0 },
    { type: 'weakness_vulnerability', at: 0, skillName: 'First' },
    { type: 'weakness_vulnerability', at: 1, skillName: 'Blocked' }
  ];
  const context = {
    relic: createRelicTimelineRuntime('Aristocracy', events)
  };

  assert.equal(relicConditionDurationBonus(context, 0), 0);
  assert.equal(relicConditionDurationBonus(context, 0.001), 0.03);
  assert.equal(relicConditionDurationBonus(context, 1.002), 0.06);
});

test('Nourys owns its generic stack cadence and additive damage window', () => {
  const relic = createRelicRuntime('Nourys');
  const procSteps = [];
  const context = {
    relic,
    combatStartTime: 2,
    recordProc(kind, name, at, sourceSkill, detail) {
      procSteps.push({ kind, name, at, sourceSkill, detail });
    }
  };

  recordPassiveRelicTimeline(context, [], 70);

  assert.equal(relicOutgoingDamageBonus(context, 'strike', 31.999), 0);
  assert.equal(relicOutgoingDamageBonus(context, 'strike', 32), 0.25);
  assert.equal(relicOutgoingDamageBonus(context, 'condition', 36.999), 0.25);
  assert.equal(relicOutgoingDamageBonus(context, 'condition', 37), 0);
  assert.equal(relicOutgoingDamageBonus(context, 'strike', 67), 0.25);
  assert.deepEqual(
    procSteps.filter(({ name }) => name === 'Relic of Nourys').map(({ at }) => at),
    [32, 67]
  );
});

test('Relic of the Brawler grants four seconds of strike damage with a strict eight-second ICD', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930006,
        name: 'Grant Protection',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Protection', duration: 2, stacks: 1 }]
      },
      {
        id: 930007,
        name: 'Grant Resolution',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Resolution', duration: 2, stacks: 1 }]
      },
      {
        id: 930008,
        name: 'Brawler Fixture Strike',
        type: 'Weapon',
        weapon: 'Sword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'brawler-fixture',
    name: 'Brawler Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: [
      'Grant Protection',
      { type: 'wait', durationMs: 1000 },
      'Brawler Fixture Strike',
      { type: 'wait', durationMs: 3001 },
      'Brawler Fixture Strike',
      { type: 'wait', durationMs: 3999 },
      'Grant Resolution',
      { type: 'wait', durationMs: 1 },
      'Brawler Fixture Strike',
      { type: 'wait', durationMs: 1 },
      'Grant Protection',
      { type: 'wait', durationMs: 1 },
      'Brawler Fixture Strike'
    ],
    config: { relic: 'Brawler' }
  });
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of the Brawler');
  const strikes = result.resolvedEvents.filter((event) => event.skillName === 'Brawler Fixture Strike');

  assert.deepEqual(
    procs.map((step) => step.start),
    [0, 8002]
  );
  assert.deepEqual(
    procs.map((step) => step.sourceSkill),
    ['Grant Protection', 'Grant Protection']
  );
  assert.deepEqual(
    strikes.map((event) => Math.round(event.at * 1000)),
    [1000, 4001, 8001, 8003]
  );
  assert.ok(Math.abs(strikes[0].damage / strikes[1].damage - 1.1) < 1e-12);
  assert.equal(strikes[2].damage, strikes[1].damage);
  assert.ok(Math.abs(strikes[3].damage / strikes[1].damage - 1.1) < 1e-12);
});

test('Relic of Mistburn grants one Might for eight seconds and applies its critical chance at ten stacks', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930009,
        name: 'Grant Might',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Might', duration: 20, stacks: 1 }]
      },
      {
        id: 930010,
        name: 'Mistburn Fixture Strike',
        type: 'Weapon',
        weapon: 'Sword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'mistburn-fixture',
    name: 'Mistburn Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: [
      'Grant Might',
      { type: 'wait', durationMs: 7999 },
      'Mistburn Fixture Strike',
      { type: 'wait', durationMs: 1 },
      'Mistburn Fixture Strike'
    ],
    config: {
      relic: 'Mistburn',
      stats: { power: 1000, precision: 1000, ferocity: 0 },
      boons: { might: 8, fury: false }
    }
  });
  const bonusMight = result.events.filter((event) => event.sourceId === 'relic.mistburn');
  const strikes = result.resolvedEvents.filter((event) => event.skillName === 'Mistburn Fixture Strike');

  assert.deepEqual(
    bonusMight.map(({ at, duration, stacks }) => ({ at, duration, stacks })),
    [{ at: 0, duration: 8, stacks: 1 }]
  );
  assert.ok(Math.abs(strikes[0].criticalChance - 0.15) < 1e-12);
  assert.ok(Math.abs(strikes[1].criticalChance - 0.05) < 1e-12);
  assert.deepEqual(
    result.procSteps
      .filter((step) => step.skill === 'Relic of Mistburn')
      .map((step) => ({ start: step.start, sourceSkill: step.sourceSkill })),
    [{ start: 0, sourceSkill: 'Grant Might' }]
  );
});

test('Relic of Mistburn uses a strict one-second internal cooldown', () => {
  const relic = createRelicRuntime('Mistburn');
  const emitted = [];
  const context = {
    emitDerived(cause, event) {
      emitted.push({ ...event, triggeredBy: cause.skillName });
    }
  };
  const grantMight = (at, extra = {}) =>
    materializeBoonRelics(context, relic, {
      type: 'buff',
      at,
      skillName: `Grant Might ${at}`,
      kind: 'might',
      duration: 5,
      stacks: 1,
      source: 'fixture',
      actorType: 'player',
      audience: { recipients: 'self' },
      resolvedAudience: {
        includesSelf: true,
        includesSummons: false,
        alliedPlayerCount: 0,
        companionIds: [],
        recipientCount: 1
      },
      ...extra
    });

  grantMight(0);
  grantMight(1);
  grantMight(1.001);
  grantMight(2.002, { source: 'Relic', actorType: 'effect' });

  assert.deepEqual(
    emitted.map((event) => ({ at: event.at, duration: event.duration })),
    [
      { at: 0, duration: 8 },
      { at: 1.001, duration: 8 }
    ]
  );
});

test('Relic of Bloodstone records three Volatility stacks before the fourth blast grants Fervor', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930100,
        name: 'Bloodstone Fixture Strike',
        type: 'Weapon',
        weapon: 'Sword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
      },
      {
        id: 930101,
        name: 'Bloodstone Fixture Field',
        type: 'Utility',
        castTimeMs: 0,
        comboFields: [
          {
            ownerId: 'bloodstone-fixture',
            fieldType: 'Light',
            duration: 5,
            startAnchor: 'castEnd'
          }
        ],
        effects: []
      },
      {
        id: 930102,
        name: 'Bloodstone Fixture Blast',
        type: 'Utility',
        castTimeMs: 0,
        effects: [
          {
            type: 'strike',
            coefficient: 0,
            comboFinishers: [
              {
                ownerId: 'bloodstone-fixture',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ]
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'bloodstone-fixture',
    name: 'Bloodstone Fixture',
    catalog
  });
  const config = {
    relic: 'Bloodstone',
    stats: { power: 2000, precision: 1000, ferocity: 0 },
    target: { armor: 2597, conditions: {} }
  };
  const threeBlasts = simulateGw2({
    profession,
    rotation: [
      'Bloodstone Fixture Field',
      'Bloodstone Fixture Blast',
      { type: 'wait', durationMs: 1 },
      'Bloodstone Fixture Blast',
      { type: 'wait', durationMs: 1 },
      'Bloodstone Fixture Blast',
      { type: 'wait', durationMs: 1000 }
    ],
    config
  });
  const result = simulateGw2({
    profession,
    rotation: [
      'Bloodstone Fixture Field',
      'Bloodstone Fixture Strike',
      'Bloodstone Fixture Blast',
      { type: 'wait', durationMs: 1 },
      'Bloodstone Fixture Blast',
      { type: 'wait', durationMs: 1 },
      'Bloodstone Fixture Blast',
      { type: 'wait', durationMs: 1 },
      'Bloodstone Fixture Blast',
      { type: 'wait', durationMs: 1 },
      'Bloodstone Fixture Strike',
      { type: 'wait', durationMs: 1000 }
    ],
    config
  });
  const volatility = result.procSteps.filter((step) => step.skill === 'Bloodstone Volatility');
  const fervor = result.procSteps.filter((step) => step.skill === 'Relic of Bloodstone');
  const strikes = result.resolvedEvents.filter((event) => event.skillName === 'Bloodstone Fixture Strike');
  const explosion = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Bloodstone Explosion'
  );
  const bleeding = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Bloodstone Explosion'
  );

  assert.deepEqual(
    volatility.map((step) => step.detail),
    ['1/3 stacks', '2/3 stacks', '3/3 stacks']
  );
  assert.equal(
    threeBlasts.procSteps.some((step) => step.skill === 'Relic of Bloodstone'),
    false
  );
  assert.equal(fervor.length, 1);
  assert.ok(Math.abs(strikes[1].damage / strikes[0].damage - 1.07) < 1e-12);
  assert.equal(explosion.coefficient, 3);
  assert.equal(explosion.at, 0.683);
  assert.equal(bleeding.stacks, 6);
  assert.equal(bleeding.duration, 6);
});

test('Bloodstone Fervor follows modifier ownership', () => {
  const relic = createRelicRuntime('Bloodstone');
  const context = { relic };

  relic.state.buffUntil = 8;

  const effect = {
    type: 'damage',
    at: 1,
    actorType: 'effect',
    skillName: 'Owned Effect'
  };

  assert.equal(
    relicStrikeMultiplier(context, {
      ...effect,
      ownerActorType: 'player'
    }),
    1.07
  );
  assert.equal(relicStrikeMultiplier(context, effect), 1);
  assert.equal(relicStrikeMultiplier(context, { ...effect, actorType: 'player' }), 1.07);
  assert.equal(
    relicStrikeMultiplier(context, {
      ...effect,
      ownerActorType: 'summon'
    }),
    1
  );
});

test('Claw follows modifier ownership while Peitha remains limited to player actor strikes', () => {
  const player = { type: 'damage', at: 1, actorType: 'player', skillName: 'Player Strike' };
  const ownedEffect = {
    type: 'damage',
    at: 1,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Owned Effect'
  };
  const claw = createRelicRuntime('Claw');

  claw.state.buffFrom = 0;
  claw.state.buffUntil = 8;
  assert.equal(relicStrikeMultiplier({ relic: claw }, player), 1.07);
  assert.equal(relicStrikeMultiplier({ relic: claw }, ownedEffect), 1.07);
  assert.equal(relicStrikeMultiplier({ relic: claw }, { ...ownedEffect, ownerActorType: 'summon' }), 1);

  const peitha = createRelicRuntime('Peitha');

  peitha.state.buffFrom = 0;
  peitha.state.buffUntil = 8;
  assert.equal(relicStrikeMultiplier({ relic: peitha }, player), 1.1);
  assert.equal(relicStrikeMultiplier({ relic: peitha }, ownedEffect), 1);
});

test('Relic of the Shackles strikes five seconds after immobilize with a strict ten-second ICD', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930009,
        name: 'Fixture Immobilize',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'shackles-fixture',
    name: 'Shackles Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: [
      'Fixture Immobilize',
      { type: 'wait', durationMs: 10000 },
      'Fixture Immobilize',
      { type: 'wait', durationMs: 1 },
      'Fixture Immobilize',
      { type: 'wait', durationMs: 5000 }
    ],
    config: { relic: 'Shackles' }
  });
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of the Shackles');
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Relic of the Shackles'
  );
  const stuns = result.events.filter(
    (event) => event.type === 'control' && event.skillName === 'Relic of the Shackles'
  );

  assert.deepEqual(
    procs.map((step) => ({
      start: step.start,
      detail: step.detail,
      sourceSkill: step.sourceSkill
    })),
    [
      {
        start: 0,
        detail: 'tethered',
        sourceSkill: 'Fixture Immobilize'
      },
      {
        start: 5000,
        detail: 'damage',
        sourceSkill: 'Fixture Immobilize'
      },
      {
        start: 10001,
        detail: 'tethered',
        sourceSkill: 'Fixture Immobilize'
      },
      {
        start: 15001,
        detail: 'damage',
        sourceSkill: 'Fixture Immobilize'
      }
    ]
  );
  assert.deepEqual(
    strikes.map((event) => ({
      at: event.at,
      coefficient: event.coefficient,
      source: event.source,
      triggeredBy: event.triggeredBy
    })),
    [
      {
        at: 5,
        coefficient: 3,
        source: 'Relic',
        triggeredBy: 'Fixture Immobilize'
      },
      {
        at: 15.001,
        coefficient: 3,
        source: 'Relic',
        triggeredBy: 'Fixture Immobilize'
      }
    ]
  );
  assert.deepEqual(
    stuns.map((event) => ({
      at: event.at,
      controlKind: event.controlKind,
      duration: event.duration,
      source: event.source,
      triggeredBy: event.triggeredBy
    })),
    [
      {
        at: 5,
        controlKind: 'stun',
        duration: 1,
        source: 'Relic',
        triggeredBy: 'Fixture Immobilize'
      },
      {
        at: 15.001,
        controlKind: 'stun',
        duration: 1,
        source: 'Relic',
        triggeredBy: 'Fixture Immobilize'
      }
    ]
  );
});
