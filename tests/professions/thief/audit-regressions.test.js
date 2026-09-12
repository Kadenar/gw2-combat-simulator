import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefCoreModifierRules } from '#gw2/professions/thief/core/traits/modifiers.js';
import { grantThiefStealth } from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import { beginStealthAttack } from '#gw2/professions/thief/core/mechanics/stealth.js';
import { advanceThiefCoreResources, thiefEnduranceReadyAt } from '#gw2/professions/thief/core/mechanics/resources.js';
import { addVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { reactToThiefCoreDamage } from '#gw2/professions/thief/core/traits/index.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

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
    ['Daredevil', 'Fist Flurry', {}, (state) => state.palmStrikeUntil > 0],
    ['Deadeye', 'Shadow Flare', {}, (state) => state.availableFlips[ID.SHADOW_SWAP] > 0],
    ['Specter', 'Siphon', {}, (state) => state.shadowForce > 0],
    ['Antiquary', 'Skritt Scuffle', {}, (state) => state.artifactUsesRemaining > 0]
  ];
  for (const [specialization, name, config, committed] of cases) {
    for (const cancelled of [true, false]) {
      const result = simulate(specialization, [cancelled ? { name, interruptMs: 100 } : name], config);
      assert.deepEqual(result.warnings, [], name);
      assert.equal(result.events.find((event) => event.type === 'action').cancelled === true, cancelled, name);
      assert.equal(committed(result.endState.profession), !cancelled, name);
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
  near(whole.endState.profession.endurance, split.endState.profession.endurance);
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
  assert.equal(manual.endState.profession.shadowShroudActive, false);
  const depleted = simulate('Specter', ['Enter Shadow Shroud', wait(1000)], { initialShadowForce: 0.5 });
  assert.deepEqual(depleted.warnings, []);
  assert.equal(depleted.events.find((event) => event.reason === 'shadow-shroud-depleted').at, 0.25);
  assert.equal(depleted.endState.profession.shadowShroudActive, false);
});
