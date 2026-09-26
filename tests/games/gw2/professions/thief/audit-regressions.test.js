import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefCoreAttributeRules, thiefCoreModifierRules } from '#gw2/professions/thief/core/traits/modifiers.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createThiefBuildDefaults } from '#gw2/professions/thief/build/build.js';
import { applyThiefBuildAttributeRules } from '#gw2/professions/thief/build/attributes.js';
import { beginThiefStealthAttack, grantThiefStealth } from '#gw2/professions/thief/core/mechanics/stealth.js';
import { grantThiefEndurance, grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { addVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const baseConfig = {
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  selectedSkills: [
    'Spider Venom',
    'Skale Venom',
    'Devourer Venom',
    'Thieves Guild',
    'Fist Flurry',
    'Shadow Flare',
    'Skritt Scuffle'
  ],
  stats: { power: 2000, precision: 1000, ferocity: 0, expertise: 0, conditionDamage: 1000, concentration: 0 },
  target: { armor: 2597, defiant: true }
};
const simulate = createObservedProfessionSimulator(thiefProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

/** Runs a focused scenario on the registered live owners with this file's shared build. */
function live(specialization, rotation, overrides = {}, options = {}) {
  return runThief(rotation, { ...baseConfig, ...overrides, specialization }, options);
}

test('Basilisk Venom contributes control and retains its 40-second recharge', () => {
  const result = live('Core', ['Basilisk Venom'], { selectedSkills: ['Basilisk Venom'] });
  assert.deepEqual(result.warnings, []);
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.BASILISK_VENOM);
  assert.equal(control.controlKind, 'stun');

  near(observedRuntime(result).cooldowns.get(ID.BASILISK_VENOM) - control.at, 40);
});

test("Sniper's Cover spends four initiative and opens a five-second smoke field and follow-up", () => {
  const config = { primaryWeapon: 'Rifle', secondaryWeapon: '' };
  const spent = [];
  const result = runThief(
    ['Kneel', "Sniper's Cover"],
    { ...config, specialization: 'Deadeye' },
    {
      // Read the pool around the composed cast-start hook that spends the activation's initiative.
      extend: (native) => ({
        onCastStart(runtime, cast) {
          const before = runtime.resourceController.value('initiative');
          native.onCastStart(runtime, cast);
          if (cast.skill.id === ID.SNIPERS_COVER) spent.push(before - runtime.resourceController.value('initiative'));
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(spent.length, 1);
  near(spent[0], 4);
  const field = result.events.find((event) => event.type === 'combo_field' && event.skillId === ID.SNIPERS_COVER);
  assert.equal(field.fieldType, 'Smoke');
  near(field.expiresAt - field.at, 5);
  near(result.planningState.profession.availableFlips[ID.DEATHS_ADVANCE]?.expiresAt, field.expiresAt);
  const followup = simulate('Deadeye', ['Kneel', "Sniper's Cover", "Death's Advance"], config);
  assert.deepEqual(followup.warnings, []);
  assert.equal(followup.planningState.profession.availableFlips[ID.DEATHS_ADVANCE], undefined);
  const expired = simulate('Deadeye', ['Kneel', "Sniper's Cover", wait(5000)], config);
  assert.equal(expired.planningState.profession.availableFlips[ID.DEATHS_ADVANCE], undefined);
});

test("Infiltrator's Signet pulses discrete initiative only while ready and restarts after activation or reset", () => {
  const selectedSkills = ["Infiltrator's Signet"];
  const initiative = (result) => observedRuntime(result).resourceController.value('initiative');
  const nextPulse = (result) => observedRuntime(result).profession.core.infiltratorsSignetPulseAt;
  // Splitting waits cannot change the pulse, and the normal resource cap still applies.
  for (const rotation of [[wait(10000)], [wait(9999), wait(1)]]) {
    const result = live('Core', rotation, { selectedSkills, initialInitiative: 0 });
    assert.deepEqual(result.warnings, []);
    assert.equal(initiative(result), 11);
    // The pulse at ten seconds has already run and owns the next one.
    assert.equal(nextPulse(result), 20);
  }

  assert.equal(initiative(live('Core', [wait(10000)], { selectedSkills: [], initialInitiative: 0 })), 10);
  assert.equal(initiative(live('Core', [wait(20000)], { selectedSkills })), 12);

  const active = live('Core', ["Infiltrator's Signet", wait(10000)], { selectedSkills, initialInitiative: 0 });
  assert.equal(initiative(active), 10);
  assert.equal(observedRuntime(active).cooldowns.get(ID.INFILTRATORS_SIGNET), 20);
  assert.equal(nextPulse(active), 30);
  const reset = live('Core', ["Infiltrator's Signet", wait(1000), { type: 'cooldown-reset' }], {
    selectedSkills,
    initialInitiative: 0
  });
  assert.equal(nextPulse(reset), 11);

  const step = simulate('Core', ["Infiltrator's Signet", wait(1000)], {
    selectedSkills,
    relic: 'Peitha',
    selectedTraitIds: [TRAIT.FLUID_STRIKES]
  });
  assert.deepEqual(step.warnings, []);
  assert.ok(step.events.some((event) => event.type === 'peitha' && event.skillId === ID.INFILTRATORS_SIGNET));
  assert.ok(step.planningState.profession.fluidStrikesUntil > 1);
  assert.ok(
    step.resolvedEvents.some(
      (event) => event.type === 'condition' && event.skillName === 'Relic of Peitha' && event.condition === 'Torment'
    )
  );
});

test('Signet of Agility grants precision while ready and restores 100 endurance on its 30-second recharge', () => {
  const selectedSkills = ['Signet of Agility'];
  const calculate = createCalculateAttributes(applyThiefBuildAttributeRules);
  const build = createThiefBuildDefaults();
  assert.equal(
    calculate(build, [thiefCatalog.skillsById.get(ID.SIGNET_OF_AGILITY)]).attributes.Precision.final -
      calculate(build, []).attributes.Precision.final,
    180
  );

  // The live cooldown clock drives passive suppression, recovery, and cooldown resets for raw and panel stats.
  const precision = (runtime, config, attributes) =>
    thiefCoreAttributeRules.modifyAttributes(
      { catalog: thiefCatalog, config, timeline: runtime.query.timeline, time: runtime.time },
      attributes
    ).precision;
  for (const specialization of ['Core', 'Daredevil']) {
    for (const initial of [0, 75]) {
      const observed = [];
      const probe = (runtime) => {
        for (const professionStaticRulesApplied of [false, true]) {
          const config = { selectedSkills, attributeProvenance: { professionStaticRulesApplied } };
          const attributes = { ...baseConfig.stats, precision: professionStaticRulesApplied ? 1180 : 1000 };
          observed.push([runtime.time, professionStaticRulesApplied, precision(runtime, config, attributes)]);
        }

        observed.push([runtime.time, 'unselected', precision(runtime, { selectedSkills: [] }, baseConfig.stats)]);
      };

      const result = live(
        specialization,
        ['Signet of Agility', wait(30000)],
        { selectedSkills, initialEndurance: initial, boons: { vigor: false } },
        { probes: [0, 1, 29.9, 30].map((at) => [at, probe]) }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(runtime.cooldowns.get(ID.SIGNET_OF_AGILITY), 30);
      const capacity = thiefProfession.runtimeFor({ specialization }).endurance.maximum(runtime);
      // The restoration applies at the instant cast's completion, before any regeneration.
      assert.equal(
        result.events.find((event) => event.type === 'action' && event.skillId === ID.SIGNET_OF_AGILITY).endsAt,
        0
      );
      assert.ok(result.planningState.profession.endurance >= Math.min(capacity, initial + 100));
      for (const [time, staticRules, value] of observed) {
        if (staticRules === 'unselected') assert.equal(value, 1000, `${time}`);
        else if (time === 0) continue;
        else assert.equal(value, time >= 30 ? 1180 : 1000, `${specialization} ${time} ${staticRules}`);
      }
    }
  }

  const resetPrecision = [];
  const reset = live(
    'Core',
    ['Signet of Agility', wait(1000), { type: 'cooldown-reset' }, wait(1000)],
    {
      selectedSkills
    },
    {
      probes: [[2, (runtime) => resetPrecision.push(precision(runtime, { selectedSkills }, baseConfig.stats))]]
    }
  );
  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(resetPrecision, [1180]);
});

test('Signet of Agility restores endurance up to each elite capacity', () => {
  for (const [specialization, capacity] of [
    ['Core', 100],
    ['Daredevil', 150]
  ]) {
    for (const initial of [0, 75]) {
      const result = live(specialization, ['Signet of Agility'], {
        selectedSkills: ['Signet of Agility'],
        initialEndurance: initial
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(result.planningState.profession.endurance, Math.min(capacity, initial + 100));
    }
  }
});

test('Thief resource grants settle passive recovery at the live clock before applying', () => {
  const observed = [];
  const result = live(
    'Core',
    [wait(2000)],
    { initialInitiative: 3, initialEndurance: 10, boons: { vigor: false } },
    {
      probes: [
        [
          2,
          (runtime) => {
            grantThiefInitiative(runtime, 2);
            grantThiefInitiative(runtime, 0);
            grantThiefEndurance(runtime, 7);
            grantThiefEndurance(runtime, 0);
            observed.push(runtime.resourceController.value('initiative'), runtime.profession.core.endurance);
            observed.push(runtime.profession.core.enduranceUpdatedAt);
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  // Two seconds of recovery (one initiative and five endurance per second) precede each grant.
  assert.deepEqual(observed, [7, 27, 2]);
});

test('permanent Vigor bypasses history for Thief advancement and readiness', () => {
  // Both resource entry points must select the fixed-rate path, including capped recovery.
  const observed = [];
  const guarded = (runtime, read) => {
    const history = runtime.history;
    runtime.history = new Proxy(history, {
      get(events, key, receiver) {
        if (key === 'filter') assert.fail('Permanent Vigor scanned history');
        return Reflect.get(events, key, receiver);
      }
    });
    try {
      return read();
    } finally {
      runtime.history = history;
    }
  };

  const result = live(
    'Core',
    [wait(100000)],
    { boons: { vigor: true }, initialEndurance: 0 },
    {
      probes: [
        [0, (runtime) => observed.push(guarded(runtime, () => runtime.endurance.readyAt(50)))],
        [
          4,
          (runtime) =>
            guarded(runtime, () => {
              runtime.endurance.advance();
              observed.push(runtime.profession.core.endurance, runtime.endurance.readyAt(50));
            })
        ],
        [
          100,
          (runtime) =>
            guarded(runtime, () => {
              runtime.endurance.advance();
              observed.push(runtime.profession.core.endurance);
            })
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  near(observed[0], 6.68);
  assert.equal(observed[1], 30);
  near(observed[2], 6.68);
  assert.equal(observed[3], 100);
});

test('THF-001: Hidden Killer requires stealth and lingers after either natural expiry or an attack', () => {
  const rule = thiefCoreModifierRules.find((entry) => entry.id === 'thief.hidden-killer');
  const skill = thiefCatalog.skillsById.get(ID.BACKSTAB);
  const config = { ...baseConfig, specialization: 'Core', selectedTraitIds: [TRAIT.HIDDEN_KILLER] };
  const run = (attack) =>
    observedRuntime(
      live('Core', [wait(2000)], config, {
        probes: [
          [1, (runtime) => grantThiefStealth(runtime, skill, 3)],
          ...(attack ? [[2, (runtime) => beginThiefStealthAttack(runtime, { skill, id: 'test-attack' })]] : [])
        ]
      })
    );
  const active = (runtime, time) =>
    rule.when({ config, runtime: { profession: runtime.profession }, event: { actorType: 'player' }, time });

  const natural = run(false);
  assert.equal(active(natural, 0.5), false);
  assert.equal(active(natural, 1), true);
  assert.equal(active(natural, 4), true);
  assert.equal(active(natural, 7.99), true);
  assert.equal(active(natural, 8), false);
  const attacked = run(true);
  assert.equal(attacked.profession.core.hiddenKillerUntil, 6);
  assert.equal(active(attacked, 5.99), true);
  assert.equal(active(attacked, 6), false);
  const opening = simulate('Core', ['Double Strike'], { selectedTraitIds: [TRAIT.HIDDEN_KILLER] });
  assert.ok(
    opening.resolvedEvents.filter((event) => event.type === 'damage').every((event) => event.criticalChance < 1)
  );
});

test('THF-002: Signet of Shadows is excluded from the simulator', () => {
  assert.equal(thiefCatalog.skillsById.has(13060), false);
  assert.equal(thiefCatalog.skillsByName.has('Signet of Shadows'), false);
});

test('THF-003: cancelled activations preserve persistent state while successful casts commit it', () => {
  const cases = [
    ['Core', 'Thieves Guild', {}, (state) => Boolean(state.activeThievesGuild)],
    ['Core', 'Mantis Sting', { primaryWeapon: 'Spear', secondaryWeapon: '' }, (state) => state.spearChainStage === 1],
    ['Daredevil', 'Fist Flurry', {}, (state) => state.availableFlips[ID.PALM_STRIKE]?.expiresAt > 0],
    ['Deadeye', 'Shadow Flare', {}, (state) => state.availableFlips[ID.SHADOW_SWAP]?.expiresAt > 0],
    ['Specter', 'Siphon', {}, (state) => state.shadowClock.value > 0],
    ['Antiquary', 'Skritt Scuffle', {}, (state) => state.artifactUsesRemaining > 0]
  ];
  for (const [specialization, name, config, committed] of cases) {
    for (const cancelled of [true, false]) {
      const result = simulate(specialization, [cancelled ? { name, interruptMs: 100 } : name], config);
      assert.deepEqual(result.warnings, [], name);
      assert.equal(result.events.find((event) => event.type === 'action').cancelled === true, cancelled, name);
      assert.equal(committed(result.planningState.profession), !cancelled, name);
    }
  }
});

test('THF-004: one strike consumes every active venom but emits only one player siphon', () => {
  for (const venoms of [[ID.SPIDER_VENOM], [ID.SPIDER_VENOM, ID.SKALE_VENOM, ID.DEVOURER_VENOM]]) {
    const result = live(
      'Core',
      ['Heartseeker'],
      { selectedTraitIds: [TRAIT.LEECHING_VENOMS] },
      {
        initialize: (runtime) => {
          for (const id of venoms) addVenomCharges(runtime.profession.core, id, 0, 2, 24);
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const strikes = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.HEARTSEEKER && event.actorType === 'player'
    );
    assert.equal(strikes.length, 1);
    const siphons = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.sourceId === TRAIT.LEECHING_VENOMS
    );
    assert.equal(siphons.length, 1);
    const batches = observedRuntime(result).profession.core.venomChargeBatches;
    for (const id of venoms) {
      assert.equal(batches[id][0].charges, 1);
      assert.ok(
        result.resolvedEvents.some(
          (event) => event.type === 'condition' && event.skillId === id && event.at === strikes[0].at
        )
      );
    }
  }
});

test('THF-006: Rot Wallow Venom uses the bounded allied strike window, including expiry equality', () => {
  for (const [strikesPerSecond, expectedAt] of [
    [1, 1],
    [0.1, 10],
    [0.05, null]
  ]) {
    const result = simulate('Specter', ['Enter Shadow Shroud', wait(21000)], {
      initialShadowForce: 100,
      allies: { count: 1, strikesPerSecond }
    });
    assert.deepEqual(result.warnings, []);
    const procs = result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.DARK_SENTRY);
    assert.deepEqual(
      procs.map((event) => event.at),
      expectedAt == null ? [] : [expectedAt]
    );
  }
});

test('THF-007: Sun Crystal enhances base Burning once and preserves already-enhanced Burning', () => {
  for (const expertise of [0, 750]) {
    const result = simulate(
      'Antiquary',
      ['Skritt Swipe', 'Zephyrite Sun Crystal'],
      { selectedTraitIds: [TRAIT.METICULOUS_CUSTODIAN], stats: { expertise } },
      { kind: 'tail', durationMs: 1000 }
    );
    assert.deepEqual(result.warnings, []);
    const burns = result.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' && event.skillId === ID.ZEPHYRITE_SUN_CRYSTAL && event.condition === 'Burning'
    );
    assert.ok(burns.some((event) => event.triggeredBy));
    assert.ok(burns.some((event) => !event.triggeredBy));
    for (const burn of burns) near(burn.effectiveDuration, expertise ? 7.5 : 5);
  }
});

test('THF-008: endurance and readiness are invariant across Vigor expiry, extensions, and the cap', () => {
  for (const initial of [0, 95]) {
    const run = (targets) => {
      const observed = {};
      live(
        'Core',
        [wait(10000)],
        { initialEndurance: initial, boons: { vigor: false } },
        {
          initialize(runtime) {
            runtime.emit({
              type: 'buff',
              at: 0,
              source: 'Test',
              sourceId: 'test.vigor',
              actorType: 'player',
              kind: 'vigor',
              boon: 'vigor',
              duration: 4,
              stacks: 1
            });
            runtime.emit({
              type: 'boon_extension',
              at: 2,
              source: 'Test',
              sourceId: 'test.extension',
              actorType: 'player',
              kind: 'vigor',
              duration: 2
            });
          },
          // Intermediate observations must not change the settled pool or its readiness. Readiness is read once the
          // extension has applied, since the live clock cannot see a later event.
          probes: [
            [2, (runtime) => (observed.readyBefore = runtime.endurance.readyAt(50))],
            ...targets.map((target) => [
              target,
              (runtime) => {
                runtime.endurance.advance();
                observed.endurance = runtime.profession.core.endurance;
                observed.readyAfter = runtime.endurance.readyAt(50);
              }
            ])
          ]
        }
      );
      return observed;
    };

    const single = run([10]);
    assert.deepEqual(run([2, 4, 6, 10]), single);
    near(single.endurance, initial ? 100 : 65);
    near(single.readyBefore, initial ? 2 : 7);
  }

  const rotation = ['Dodge', 'Dodge', 'Steal'];
  const config = { selectedTraitIds: [TRAIT.BOUNTIFUL_THEFT] };
  const whole = simulate('Core', [...rotation, wait(12000)], config);
  const split = simulate('Core', [...rotation, wait(10000), wait(2000)], config);
  assert.deepEqual(whole.warnings, []);
  assert.deepEqual(split.warnings, []);
  near(whole.planningState.profession.endurance, split.planningState.profession.endurance);
});

/** Seeds a marked, stealthed Deadeye before its first command. */
function markedDeadeye(malice, marked) {
  return (runtime) => {
    Object.assign(runtime.profession.core, { stealthUntil: 10 });
    Object.assign(runtime.profession.specialization.state, {
      malice,
      markedTargetId: marked ? 'primary-target' : null,
      markExpiresAt: marked ? 30 : 0
    });
  };
}

test('THF-009: malicious sword, staff, axe, and scepter use the consumed malice snapshot', () => {
  for (const [name, weapon] of [
    ['Malicious Tactical Strike', 'Sword'],
    ['Malicious Hook Strike', 'Staff'],
    ['Malicious Cunning Salvo', 'Axe'],
    ['Malicious Shadowsquall', 'Scepter']
  ]) {
    for (const malice of [0, 4]) {
      const result = live(
        'Deadeye',
        [name],
        {
          primaryWeapon: weapon,
          secondaryWeapon: '',
          selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
          initialEndurance: 0,
          boons: { vigor: false }
        },
        { initialize: markedDeadeye(malice, true) }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(runtime.profession.specialization.state.malice, 2);
      if (weapon === 'Sword') {
        near(runtime.profession.core.endurance, runtime.time * 5 + malice * 10);
      } else if (weapon === 'Staff') {
        const boon = result.events.find((event) => event.type === 'buff' && event.kind === 'quickness');
        near(Number(boon?.duration || 0), malice * 0.75);
        assert.equal(boon != null, malice > 0);
      } else {
        const poison = result.events.find((event) => event.type === 'condition' && event.condition === 'Poisoned');
        near(poison.duration, weapon === 'Axe' ? 1 + malice : 3 * (1 + 0.2 * malice));
      }
    }
  }
});

test('THF-009: unmarked and missed attacks grant no malicious sword or staff benefit', () => {
  for (const weapon of ['Sword', 'Staff']) {
    for (const marked of [true, false]) {
      const name = weapon === 'Sword' ? 'Malicious Tactical Strike' : 'Malicious Hook Strike';
      const result = live(
        'Deadeye',
        [{ name, offTarget: marked }],
        { primaryWeapon: weapon, secondaryWeapon: '', initialEndurance: 0, boons: { vigor: false } },
        { initialize: markedDeadeye(4, marked) }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(runtime.profession.specialization.state.malice, 4);
      assert.equal(
        result.events.some((event) => event.type === 'buff' && event.kind === 'quickness'),
        false
      );
      near(runtime.profession.core.endurance, runtime.time * 5);
    }
  }
});

test('THF-010: Leeching Venoms uses its flat Power formula across armor, weapons, and strike modifiers', () => {
  for (const armor of [2597, 5194]) {
    for (const [primaryWeapon, secondaryWeapon, attack] of [
      ['Dagger', 'Dagger', 'Heartseeker'],
      ['Pistol', 'Pistol', 'Vital Shot']
    ]) {
      for (const modified of [false, true]) {
        const result = simulate('Core', ['Spider Venom', attack], {
          primaryWeapon,
          secondaryWeapon,
          target: { armor, conditions: { Vulnerability: modified ? 25 : 0 } },
          selectedTraitIds: [TRAIT.LEECHING_VENOMS, ...(modified ? [TRAIT.EXPOSED_WEAKNESS] : [])]
        });
        assert.deepEqual(result.warnings, []);
        const siphon = result.resolvedEvents.find(
          (event) => event.type === 'damage' && event.sourceId === TRAIT.LEECHING_VENOMS
        );
        assert.ok(siphon);
        near(siphon.damage, 320 + 0.033 * 2000);
        assert.equal(siphon.critEligible, false);
      }
    }
  }
});

test('THF-011: Heartseeker produces a smoke leap only inside a live field', () => {
  for (const expiresAt of [0, 10]) {
    const result = live(
      'Core',
      ['Heartseeker'],
      {},
      {
        initialize(runtime) {
          if (expiresAt)
            runtime.emit({
              type: 'combo_field',
              at: 0,
              expiresAt,
              source: 'Test',
              sourceId: 'test.smoke',
              actorType: 'effect',
              fieldId: 'test.smoke',
              fieldType: 'Smoke',
              ownerId: 'thief',
              ownerActorType: 'player'
            });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const stealth = result.events.filter((event) => event.type === 'buff' && event.kind === 'stealth' && event.comboId);
    assert.equal(stealth.length, expiresAt ? 1 : 0);
    if (expiresAt) assert.equal(stealth[0].at, result.events.find((event) => event.type === 'damage').at);
  }
});

test('THF-012: manual shroud exit waits for entry lockout while forced depletion bypasses it', () => {
  const manual = simulate('Specter', ['Enter Shadow Shroud', 'Exit Shadow Shroud'], { initialShadowForce: 100 });
  assert.deepEqual(manual.warnings, []);
  assert.equal(manual.steps[1].start, 500);
  assert.equal(manual.planningState.profession.shadowShroudActive, false);
  const depleted = simulate('Specter', ['Enter Shadow Shroud', wait(1000)], { initialShadowForce: 0.5 });
  assert.deepEqual(depleted.warnings, []);
  const exit = depleted.events.find(
    (event) => event.type === 'weapon_set' && event.shroudSwap && event.sourceId === 'thief.shadow-shroud-depleted'
  );
  assert.equal(exit.at, 0.28);
  assert.equal(depleted.planningState.profession.shadowShroudActive, false);
});

/** A test-authored guild isolates cadence and replacement from the production summon profiles. */
const guildCatalog = (summonAttack) => (catalog) =>
  withSkill(catalog, ID.THIEVES_GUILD, {
    castTimeMs: 0,
    cooldown: 0,
    summonAttack: { ...catalog.skillsById.get(ID.THIEVES_GUILD).summonAttack, ...summonAttack }
  });
const guildPackets = (result) =>
  result.events.filter((event) => event.type === 'damage' && event.sourceId === 'thief.thieves-guild');

test('guild summons with empty attacks stay inactive after combat starts', () => {
  const result = live(
    'Core',
    ['Thieves Guild', { type: 'combat-start' }, wait(2000)],
    {},
    { catalog: guildCatalog({ summons: [{ name: 'Silent thief', weapon: 'Dagger', attacks: [] }] }) }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(guildPackets(result), []);
});

test('guild combat activation starts parallel streams once and replacement retires every old stream', () => {
  const catalog = guildCatalog({
    duration: 6,
    summons: [
      {
        name: 'Test thief',
        weapon: 'Dagger',
        attacks: [
          { name: 'Fast', coefficientPerHit: 1, initialDelay: 0, interval: 1 },
          { name: 'Slow', coefficientPerHit: 1, initialDelay: 0.5, interval: 2 }
        ]
      }
    ]
  });
  // No stream starts before the marker; the combat boundary starts each authored attack once.
  const first = live('Core', ['Thieves Guild', wait(1000), { type: 'combat-start' }, wait(1000)], {}, { catalog });
  assert.deepEqual(first.warnings, []);
  assert.deepEqual(
    guildPackets(first).map((event) => [event.at, event.damageBreakdownName]),
    [
      [1, 'Test thief — Fast'],
      [1.5, 'Test thief — Slow'],
      [2, 'Test thief — Fast']
    ]
  );

  const guilds = [];
  const replaced = live(
    'Core',
    ['Thieves Guild', wait(1000), { type: 'combat-start' }, wait(1250), 'Thieves Guild', wait(7000)],
    {},
    {
      catalog,
      probes: [
        [2, (runtime) => guilds.push(runtime.profession.core.activeThievesGuild?.ownerId)],
        [2.3, (runtime) => guilds.push(runtime.profession.core.activeThievesGuild?.ownerId)],
        [6, (runtime) => guilds.push(runtime.profession.core.activeThievesGuild?.ownerId)],
        [9, (runtime) => guilds.push(runtime.profession.core.activeThievesGuild)]
      ]
    }
  );
  assert.deepEqual(replaced.warnings, []);
  assert.notEqual(guilds[1], guilds[0]);
  assert.equal(guilds[2], guilds[1], 'old expiry cannot remove the replacement');
  assert.equal(guilds[3], null);
  const packets = guildPackets(replaced);
  assert.deepEqual(
    packets.filter((event) => event.at > 2 && event.at < 3.5).map((event) => event.at),
    [2.25, 2.75, 3.25]
  );
  assert.equal(new Set(packets.map((event) => event.activationId)).size, packets.length);
  assert.ok(packets.every((event) => event.at < 8.25));
});
