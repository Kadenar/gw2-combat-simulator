import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskQueue } from '#gw2/platform/execution/tasks.js';
import {
  summonThievesGuild,
  observeThievesGuildCombatEvent,
  thievesGuildTaskHandlers
} from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/policy.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefCoreAttributeRules, thiefCoreModifierRules } from '#gw2/professions/thief/core/traits/modifiers.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createThiefBuildDefaults } from '#gw2/professions/thief/build/build.js';
import { applyThiefBuildAttributeRules } from '#gw2/professions/thief/build/attributes.js';
import { grantThiefStealth } from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import { beginStealthAttack } from '#gw2/professions/thief/core/mechanics/stealth.js';
import { advanceThiefCoreResources, thiefEnduranceReadyAt } from '#gw2/professions/thief/core/mechanics/resources.js';
import { gainThiefEndurance, gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { addVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { reactToThiefCoreDamage } from '#gw2/professions/thief/core/traits/index.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

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
const simulate = createProfessionSimulator(thiefProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

// Use the real scheduler context so state, event ownership, and balance profiles follow production contracts.
function scheduler(specialization = 'Core', overrides = {}) {
  const config = { ...baseConfig, ...overrides, specialization };
  return createScheduler({ profession: thiefProfession, config, schedulerPolicy: createGw2SchedulerPolicy(config) });
}

test('Basilisk Venom contributes control and retains its 40-second recharge', () => {
  const scheduled = scheduler('Core', { selectedSkills: ['Basilisk Venom'] });
  const result = scheduled.run(['Basilisk Venom']);
  assert.deepEqual(result.warnings, []);
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.BASILISK_VENOM);
  assert.equal(control.controlKind, 'stun');

  near(scheduled.context.state.cooldowns.get(ID.BASILISK_VENOM) - control.at, 40);
});

test("Sniper's Cover spends four initiative and opens a five-second smoke field and follow-up", () => {
  const config = { primaryWeapon: 'Rifle', secondaryWeapon: '' };
  const result = simulate('Deadeye', ['Kneel', "Sniper's Cover"], config);
  assert.deepEqual(result.warnings, []);
  const spentIndex = result.events.findLastIndex((event) => event.reason === 'initiative-spent');
  const before = result.events.slice(0, spentIndex).findLast((event) => event.type === 'thief.state');
  near(before.state.initiative - result.events[spentIndex].state.initiative, 4);
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
  // Splitting waits cannot change the pulse, and the normal resource cap still applies.
  for (const rotation of [[wait(10000)], [wait(9999), wait(1)]]) {
    const scheduled = scheduler('Core', { selectedSkills, initialInitiative: 0 });
    const result = scheduled.run(rotation);
    assert.deepEqual(result.warnings, []);
    assert.equal(scheduled.context.state.profession.core.initiative, 11);
    assert.equal(result.events.find((event) => event.reason === 'infiltrators-signet').at, 10);
  }

  const unequipped = scheduler('Core', { selectedSkills: [], initialInitiative: 0 });
  unequipped.run([wait(10000)]);
  assert.equal(unequipped.context.state.profession.core.initiative, 10);
  const capped = scheduler('Core', { selectedSkills });
  capped.run([wait(20000)]);
  assert.equal(capped.context.state.profession.core.initiative, 12);

  const active = scheduler('Core', { selectedSkills, initialInitiative: 0 });
  active.run(["Infiltrator's Signet", wait(10000)]);
  assert.equal(active.context.state.profession.core.initiative, 10);
  assert.equal(active.context.state.cooldowns.get(ID.INFILTRATORS_SIGNET), 20);
  assert.equal(active.context.tasks.nextAt('thief.infiltrators-signet'), 30);
  const reset = scheduler('Core', { selectedSkills, initialInitiative: 0 });
  reset.run(["Infiltrator's Signet", wait(1000), { type: 'cooldown-reset' }]);
  assert.equal(reset.context.tasks.nextAt('thief.infiltrators-signet'), 11);

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

  // Real activation events drive passive suppression, recovery, and cooldown resets for raw and panel stats.
  for (const specialization of ['Core', 'Daredevil']) {
    for (const initial of [0, 75]) {
      const scheduled = scheduler(specialization, { selectedSkills });
      const core = scheduled.context.state.profession.core;
      core.endurance = initial;
      const result = scheduled.run(['Signet of Agility']);
      assert.deepEqual(result.warnings, []);
      assert.equal(core.endurance, Math.min(core.maximumEndurance, initial + 100));
      assert.equal(scheduled.context.state.cooldowns.get(ID.SIGNET_OF_AGILITY), 30);
      const timeline = createGw2TimelineIndex({ events: result.events });
      for (const professionStaticRulesApplied of [false, true]) {
        const config = { selectedSkills, attributeProvenance: { professionStaticRulesApplied } };
        const attributes = { ...baseConfig.stats, precision: professionStaticRulesApplied ? 1180 : 1000 };
        assert.equal(
          thiefCoreAttributeRules.modifyAttributes(
            { catalog: thiefCatalog, config, timeline: createGw2TimelineIndex(), time: 0 },
            attributes
          ).precision,
          1180
        );
        for (const [time, expected] of [
          [1, 1000],
          [29.9, 1000],
          [30, 1180]
        ]) {
          assert.equal(
            thiefCoreAttributeRules.modifyAttributes({ catalog: thiefCatalog, config, timeline, time }, attributes)
              .precision,
            expected
          );
        }

        assert.equal(
          thiefCoreAttributeRules.modifyAttributes(
            { config: { selectedSkills: [] }, timeline, time: 1 },
            baseConfig.stats
          ).precision,
          1000
        );
      }
    }
  }

  const reset = scheduler('Core', { selectedSkills }).run([
    'Signet of Agility',
    wait(1000),
    { type: 'cooldown-reset' }
  ]);
  assert.deepEqual(reset.warnings, []);
  const timeline = createGw2TimelineIndex({ events: reset.events });
  assert.equal(
    thiefCoreAttributeRules.modifyAttributes(
      { catalog: thiefCatalog, config: { selectedSkills }, timeline, time: 2 },
      baseConfig.stats
    ).precision,
    1180
  );
});

test('Thief resource grants preserve snapshot identity, deduplication, and passive recovery', () => {
  // Grants publish immediate state without moving the passive recovery anchor or changing earlier snapshots.
  const { context } = scheduler('Core', { boons: { vigor: false } });
  const state = context.state.profession.core;
  Object.assign(state, { initiative: 3, initiativeUpdatedAt: 1, endurance: 10, enduranceUpdatedAt: 1 });
  gainThiefInitiative(context, 2, 2, 'initiative-grant');
  const initiative = context.events.at(-1);
  gainThiefInitiative(context, 0, 2, 'initiative-grant');
  assert.equal(context.events.at(-1), initiative);
  gainThiefEndurance(context, 7, 2, 'endurance-grant');
  const endurance = context.events.at(-1);
  gainThiefEndurance(context, 0, 2, 'endurance-grant');
  assert.equal(context.events.at(-1), endurance);
  assert.ok(initiative.eventOrder < endurance.eventOrder);
  for (const [snapshot, reason] of [
    [initiative, 'initiative-grant'],
    [endurance, 'endurance-grant']
  ]) {
    assert.equal(snapshot.type, 'thief.state');
    assert.equal(snapshot.source, 'thief');
    assert.equal(snapshot.sourceId, `thief.state.${reason}`);
    assert.equal(snapshot.actorType, 'player');
    assert.equal(snapshot.reason, reason);
    assert.equal(snapshot.at, 2);
  }

  assert.equal(state.enduranceUpdatedAt, 1);
  advanceThiefCoreResources(context, 2);
  assert.equal(state.endurance, 22);
  assert.equal(state.initiative, 6);
  assert.equal(initiative.state.initiative, 5);
  assert.equal(initiative.state.endurance, 10);
  assert.equal(endurance.state.endurance, 17);
});

test('permanent Vigor bypasses history for Thief advancement and readiness', () => {
  // Both resource entry points must select the fixed-rate path, including capped recovery.
  const { context } = scheduler('Core', { boons: { vigor: true } });
  const state = context.state.profession.core;
  state.endurance = 0;
  const current = {
    ...context,
    events: new Proxy(context.events, {
      get(events, key, receiver) {
        if (key === 'filter') assert.fail('Permanent Vigor scanned history');
        return Reflect.get(events, key, receiver);
      }
    })
  };
  near(thiefEnduranceReadyAt({ ...current, start: 0 }, 50), 50 / 7.5);
  advanceThiefCoreResources(current, 4);
  assert.equal(state.endurance, 30);
  near(thiefEnduranceReadyAt({ ...current, start: 4 }, 50), 4 + 20 / 7.5);
  advanceThiefCoreResources(current, 100);
  assert.equal(state.endurance, state.maximumEndurance);
});

test('empty Thief endurance windows still advance initiative, expire temporary state, and emit a snapshot', () => {
  // An endurance-only no-op must not skip the rest of the resource update.
  for (const enduranceUpdatedAt of [2, 3]) {
    const { context } = scheduler('Core', { boons: { vigor: false } });
    const state = context.state.profession.core;
    Object.assign(state, {
      endurance: 10,
      enduranceUpdatedAt,
      initiative: 0,
      initiativeUpdatedAt: 0,
      leadAttackExpirations: [1, 4],
      availableFlips: { [ID.SHADOW_SWAP]: armSkillFlip({}, 0, 0, 2) },
      activeThievesGuild: { expiresAt: 2 }
    });
    addVenomCharges(state, ID.SPIDER_VENOM, 0, 2, 2);
    advanceThiefCoreResources(
      {
        ...context,
        events: new Proxy(context.events, {
          get(events, key, receiver) {
            if (key === 'filter') assert.fail('Empty endurance window scanned history');
            return Reflect.get(events, key, receiver);
          }
        })
      },
      2
    );
    assert.equal(state.endurance, 10);
    assert.equal(state.enduranceUpdatedAt, enduranceUpdatedAt);
    assert.equal(state.initiative, 2);
    assert.equal(state.initiativeUpdatedAt, 2);
    assert.deepEqual(state.leadAttackExpirations, [4]);
    assert.equal(state.leadAttacksStacks, 1);
    assert.deepEqual(state.availableFlips, {});
    assert.equal(state.activeThievesGuild, null);
    assert.deepEqual(state.venomChargeBatches[ID.SPIDER_VENOM], []);
    assert.equal(context.events.at(-1).type, 'thief.state');
    assert.equal(context.events.at(-1).at, 2);
  }
});

test('THF-001: Hidden Killer requires stealth and lingers after either natural expiry or an attack', () => {
  const { context } = scheduler('Core', { selectedTraitIds: [TRAIT.HIDDEN_KILLER] });
  const state = context.state.profession.core;
  const rule = thiefCoreModifierRules.find((entry) => entry.id === 'thief.hidden-killer');
  const active = (time) =>
    rule.when({
      config: context.config,
      runtime: { profession: context.state.profession },
      event: { actorType: 'player' },
      time
    });
  assert.equal(active(0), false);
  assert.equal(active(0.5), false);
  const skill = thiefCatalog.skillsById.get(ID.BACKSTAB);
  grantThiefStealth(context, skill, 1, 3);
  assert.equal(active(0.5), false);
  assert.equal(active(1), true);
  assert.equal(active(4), true);
  assert.equal(active(7.99), true);
  assert.equal(active(8), false);
  beginStealthAttack({ ...context, start: 2 }, skill);
  assert.equal(state.hiddenKillerUntil, 6);
  assert.equal(active(5.99), true);
  assert.equal(active(6), false);
  const opening = simulate('Core', ['Double Strike'], { selectedTraitIds: [TRAIT.HIDDEN_KILLER] });
  assert.ok(
    opening.resolvedEvents.filter((event) => event.type === 'damage').every((event) => event.criticalChance < 1)
  );
});

test('THF-002: Signet of Shadows is excluded from the simulator', () => {
  assert.equal(thiefCatalog.skillsById.has(ID.SIGNET_OF_SHADOWS), false);
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
    const { context } = scheduler('Core', { selectedTraitIds: [TRAIT.LEECHING_VENOMS] });
    const state = context.state.profession.core;
    for (const id of venoms) addVenomCharges(state, id, 0, 2, 24);
    const queued = [];
    const conditions = [];
    reactToThiefCoreDamage(
      {
        ...context,
        helpers: { skillsById: context.catalog.skillsById },
        applyCondition: (event) => conditions.push(event),
        queue: { enqueue: (event) => queued.push(event) }
      },
      { type: 'damage', at: 1, actorType: 'player', coefficient: 1, skillId: ID.HEARTSEEKER, skillName: 'Heartseeker' }
    );
    assert.equal(queued.filter((event) => event.sourceId === TRAIT.LEECHING_VENOMS).length, 1);
    for (const id of venoms) {
      assert.equal(state.venomChargeBatches[id][0].charges, 1);
      assert.ok(conditions.some((event) => event.skillId === id));
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
      const { context } = scheduler();
      context.state.profession.core.endurance = initial;
      context.emit({
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
      context.emit({
        type: 'boon_extension',
        at: 2,
        source: 'Test',
        sourceId: 'test.extension',
        actorType: 'player',
        kind: 'vigor',
        duration: 2
      });
      const readyBefore = thiefEnduranceReadyAt({ ...context, start: 0 }, 50);
      for (const target of targets) advanceThiefCoreResources(context, target);
      return {
        endurance: context.state.profession.core.endurance,
        readyBefore,
        readyAfter: thiefEnduranceReadyAt({ ...context, start: targets.at(-1) }, 50)
      };
    };

    const single = run([10]);
    assert.deepEqual(run([2, 4, 6, 10]), single);
    near(single.endurance, initial ? 100 : 65);
    near(single.readyBefore, initial ? 0 : 7);
  }

  const rotation = ['Dodge', 'Dodge', 'Steal'];
  const config = { selectedTraitIds: [TRAIT.BOUNTIFUL_THEFT] };
  const whole = simulate('Core', [...rotation, wait(12000)], config);
  const split = simulate('Core', [...rotation, wait(10000), wait(2000)], config);
  assert.deepEqual(whole.warnings, []);
  assert.deepEqual(split.warnings, []);
  near(whole.planningState.profession.endurance, split.planningState.profession.endurance);
});

test('THF-009: malicious sword, staff, axe, and scepter use the consumed malice snapshot', () => {
  for (const [name, weapon] of [
    ['Malicious Tactical Strike', 'Sword'],
    ['Malicious Hook Strike', 'Staff'],
    ['Malicious Cunning Salvo', 'Axe'],
    ['Malicious Shadowsquall', 'Scepter']
  ]) {
    for (const malice of [0, 4]) {
      const scheduled = scheduler('Deadeye', {
        primaryWeapon: weapon,
        secondaryWeapon: '',
        selectedTraitIds: [TRAIT.MALICIOUS_INTENT]
      });
      const { core, specialization } = scheduled.context.state.profession;
      Object.assign(core, { endurance: 0, stealthUntil: 10 });
      Object.assign(specialization.state, { malice, markedTargetId: 'primary-target', markExpiresAt: 30 });
      const result = scheduled.run([name]);
      assert.deepEqual(result.warnings, []);
      assert.equal(specialization.state.malice, 2);
      if (weapon === 'Sword') {
        const refund = result.events.find((event) => event.reason === 'malicious-tactical-strike');
        assert.ok(refund);
        near(core.endurance, scheduled.context.state.time * 5 + malice * 10);
      } else if (weapon === 'Staff') {
        const boon = result.events.find((event) => event.type === 'buff' && event.kind === 'quickness');
        near(Number(boon?.duration || 0), malice * 0.75);
        assert.equal(scheduled.context.hasBuff('quickness', 2), malice > 0);
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
      const scheduled = scheduler('Deadeye', { primaryWeapon: weapon, secondaryWeapon: '' });
      const { core, specialization } = scheduled.context.state.profession;
      Object.assign(core, { endurance: 0, stealthUntil: 10 });
      Object.assign(specialization.state, {
        malice: 4,
        markedTargetId: marked ? 'primary-target' : null,
        markExpiresAt: marked ? 30 : 0
      });
      const name = weapon === 'Sword' ? 'Malicious Tactical Strike' : 'Malicious Hook Strike';
      const result = scheduled.run([{ name, offTarget: marked }]);
      assert.deepEqual(result.warnings, []);
      assert.equal(specialization.state.malice, 4);
      assert.equal(scheduled.context.hasBuff('quickness', 0), false);
      near(core.endurance, scheduled.context.state.time * 5);
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
    const scheduled = scheduler();
    if (expiresAt)
      scheduled.context.emit({
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
    const result = scheduled.run(['Heartseeker']);
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
  assert.equal(depleted.events.find((event) => event.reason === 'shadow-shroud-depleted').at, 0.25);
  assert.equal(depleted.planningState.profession.shadowShroudActive, false);
});

// Two small authored streams isolate cadence and deferred replacement from the production summon profiles.
test('guild combat activation starts parallel streams once and replacement retires every old stream', () => {
  const tasks = createTaskQueue({ handlers: thievesGuildTaskHandlers });
  const events = [];
  const original = thiefCatalog.skillsById.get(ID.THIEVES_GUILD);
  const skill = {
    ...original,
    summonAttack: {
      ...original.summonAttack,
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
    }
  };
  const context = {
    ...scheduler().context,
    tasks,
    events,
    emit: (event) => {
      events.push(event);
      return event;
    },
    catalog: { ...thiefCatalog, skillsById: new Map([[skill.id, skill]]) },
    start: 0,
    effectiveEnd: 0,
    combatStartTime: null
  };
  summonThievesGuild(context, skill);
  tasks.drainThrough(1, context);
  assert.equal(
    events.some((event) => event.type === 'damage'),
    false
  );
  context.combatStartTime = 1;
  observeThievesGuildCombatEvent(context, { type: 'combat_start', at: 1 });
  observeThievesGuildCombatEvent(context, { type: 'combat_start', at: 1 });
  tasks.drainThrough(2, context);
  const packets = () => events.filter((event) => event.type === 'damage');
  assert.deepEqual(
    packets().map((event) => [event.at, event.damageBreakdownName]),
    [
      [1, 'Test thief — Fast'],
      [1.5, 'Test thief — Slow'],
      [2, 'Test thief — Fast']
    ]
  );
  const oldOwner = context.state.profession.core.activeThievesGuild.ownerId;
  context.start = context.effectiveEnd = 2.25;
  summonThievesGuild(context, skill);
  assert.notEqual(context.state.profession.core.activeThievesGuild.ownerId, oldOwner);
  tasks.drainThrough(3.5, context);
  assert.deepEqual(
    packets()
      .filter((event) => event.at > 2)
      .map((event) => event.at),
    [2.25, 2.75, 3.25]
  );
  assert.equal(new Set(packets().map((event) => event.activationId)).size, packets().length);
  tasks.drainThrough(6, context);
  assert.ok(context.state.profession.core.activeThievesGuild, 'old expiry cannot remove the replacement');
  tasks.drainThrough(9, context);
  assert.equal(context.state.profession.core.activeThievesGuild, null);
  assert.equal(tasks.nextAt(), Infinity);
  assert.ok(packets().every((event) => event.at < 8.25));
});
