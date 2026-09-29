import { createProcRegistry } from '#gw2/platform/combat/procs.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { applyViciousEmpowerment } from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { reactToEngineerCondition } from '#gw2/professions/engineer/core/traits/dispatch.js';
import { ENGINEER_TRAIT_IDS } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { createGuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { guardianCatalog } from '#gw2/professions/guardian/profession.js';
import { reactToAshesHit } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { createFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/initial-state.js';
import { triggerIneptitudeFromInterrupt } from '#gw2/professions/mesmer/core/traits/behavior.js';
import { MESMER_TRAIT_IDS } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/profession.js';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/initial-state.js';
import {
  applyVampiricPresence,
  reactToVampiricPresenceAlliedHit
} from '#gw2/professions/necromancer/core/traits/life-steal.js';
import {
  reactToNecromancerBlind,
  reactToNecromancerCoreDamage
} from '#gw2/professions/necromancer/core/traits/reactions.js';
import { NECROMANCER_TRAIT_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { scourgeResolverEventReactions } from '#gw2/professions/necromancer/specializations/scourge/traits/behavior.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { RANGER_TRAIT_IDS } from '#gw2/professions/ranger/data/ids.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import {
  reactToSoulbeastBuff,
  reactToSoulbeastDamage,
  soulbeastEventHandlers
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { createSoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { REVENANT_LEGEND_IDS, REVENANT_TRAIT_IDS } from '#gw2/professions/revenant/data/ids.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import { specterModule } from '#gw2/professions/thief/specializations/specter/module.js';
import { WARRIOR_SKILL_IDS, WARRIOR_TRAIT_IDS } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const READY_AT = 1;
const AFTER_READY_AT = 1.001;

// Live owners claim from each qualifying completion or landed strike; ICD deadlines stay exclusive at the boundary.
const wait = (durationMs) => ({ type: 'wait', durationMs });
const revenantCooldown = (trait, duration) => (catalog) => withProfile(catalog, trait, { cooldown: duration });
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

test('Revenant Brutality claims at swap completion and honors the exclusive ICD boundary', () => {
  for (const duration of [2, 0]) {
    const run = (selectedTraitIds) =>
      runRevenant(
        [
          wait(1000),
          'Swap Weapons',
          ...(duration ? [wait(duration * 1000)] : []),
          'Swap Weapons',
          wait(1),
          'Swap Weapons'
        ],
        { selectedTraitIds, primaryWeapon: 'Sword', secondaryWeapon: 'Sword', weaponSet2Primary: 'Hammer' },
        {
          // Free weapon swaps isolate Brutality's own cooldown.
          catalog: (catalog) =>
            withSkill(
              revenantCooldown(REVENANT_TRAIT_IDS.BRUTALITY, duration)(catalog),
              SHARED_SKILL_IDS.SWAP_WEAPONS,
              {
                cooldown: 0
              }
            )
        }
      );
    assert.deepEqual({ ...observedRuntime(run([])).procs.readyAt }, {});
    const result = run([REVENANT_TRAIT_IDS.BRUTALITY]);
    assert.deepEqual(result.warnings, []);
    // The swap at the exact deadline is blocked; one millisecond later claims again from its own completion.
    assert.deepEqual(
      result.events
        .filter((event) => event.type === 'buff' && event.skillId === REVENANT_TRAIT_IDS.BRUTALITY)
        .map((event) => event.at),
      [1, 1 + duration + 0.001]
    );
    closeTo(observedRuntime(result).procs.readyAt.brutality, 1 + duration + 0.001 + duration);
  }
});

test('Revenant Vicious Reprisal claims only eligible strikes and honors the exclusive ICD boundary', () => {
  for (const duration of [2, 0]) {
    const run = (selectedTraitIds, boons = { resolution: true }) =>
      runRevenant(
        [wait(Math.round((2 + duration) * 1000))],
        { selectedTraitIds, boons },
        {
          catalog: revenantCooldown(REVENANT_TRAIT_IDS.VICIOUS_REPRISAL, duration),
          initialize(runtime) {
            // Summon-owned and zero-coefficient packets are ineligible even while Resolution is active.
            runtime.emit(revenantHit(0.5, { actorType: 'summon', ownerActorType: 'player' }));
            runtime.emit(revenantHit(0.5, { coefficient: 0 }));
            for (const at of [1, 1 + duration, 1 + duration + 0.001]) runtime.emit(revenantHit(at));
          }
        }
      );
    const might = (result) =>
      result.events.filter((event) => event.type === 'buff' && event.sourceId === REVENANT_TRAIT_IDS.VICIOUS_REPRISAL);
    assert.deepEqual({ ...observedRuntime(run([])).procs.readyAt }, {});
    assert.deepEqual(might(run([REVENANT_TRAIT_IDS.VICIOUS_REPRISAL], {})), []);
    const result = run([REVENANT_TRAIT_IDS.VICIOUS_REPRISAL]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      might(result).map((event) => event.at),
      [1, 1 + duration + 0.001]
    );
    closeTo(observedRuntime(result).procs.readyAt.viciousReprisal, 1 + duration + 0.001 + duration);
  }
});

// Heal traits claim from the actual completion timestamp, with the shared strict cooldown boundary.
for (const [key, trait] of [
  ['darkDefense', NECROMANCER_TRAIT_IDS.DARK_DEFENSE],
  [NECROMANCER_TRAIT_IDS.MALICIOUS_SWARM, NECROMANCER_TRAIT_IDS.MALICIOUS_SWARM]
]) {
  test(`Necromancer ${key} claims only after its live completion boundary`, () => {
    for (const selected of [false, true])
      for (const completion of [1, 1.000001]) {
        const config = { specialization: 'Core', selectedTraitIds: selected ? [trait] : [] };
        const native = necromancerProfession.runtimeFor(config);
        const result = observeGw2Runtime({
          config,
          rotation: [{ type: 'wait', durationMs: completion * 1000 - 680 }, 'Well of Blood'],
          profession: {
            ...native,
            initialize(runtime) {
              native.initialize(runtime);
              runtime.procs.readyAt[key] = 1;
            }
          }
        });
        assert.equal(observedRuntime(result).procs.readyAt[key] > 1, selected && completion > 1);
        assert.deepEqual(result.warnings, []);
      }
  });
}

// Keep map claims behind local eligibility, with Dhuumfire's explicit zero-interval bypass intact.
for (const [key, trait, invoke, literalDuration] of [
  ['siphonedPower', NECROMANCER_TRAIT_IDS.SIPHONED_POWER, reactToNecromancerCoreDamage],
  ['chillOfDeath', NECROMANCER_TRAIT_IDS.CHILL_OF_DEATH, reactToNecromancerCoreDamage],
  ['chillingDarkness', NECROMANCER_TRAIT_IDS.CHILLING_DARKNESS, reactToNecromancerBlind],
  ['dhuumfire', NECROMANCER_TRAIT_IDS.DHUUMFIRE, reactToNecromancerCoreDamage]
]) {
  test(`Necromancer ${key} preserves scoped claims and exact boundaries`, () => {
    for (const duration of literalDuration == null ? [2, 0] : [literalDuration]) {
      const core = createNecromancerCoreState();
      const { context } = professionContext({
        id: 'necromancer',
        catalog: necromancerCatalog,
        core,
        config: { target: { health: 100, startingHealthFraction: 0.4 } }
      });
      context.helpers = { skillsById: necromancerCatalog.skillsById };
      const profiles = new Map(necromancerCatalog.balanceProfilesById);
      profiles.set(trait, { ...profiles.get(trait), cooldown: duration });
      context.catalog = { ...necromancerCatalog, balanceProfilesById: profiles };
      let effects = 0;
      const bypass = key === 'dhuumfire' && duration === 0;
      const emitted = (event) => {
        assert.equal(context.procs.readyAt[key], bypass ? undefined : event.at + duration);
        effects += 1;
      };

      context.emit = emitted;
      context.applyCondition = emitted;
      context.queue.enqueue = emitted;
      const opportunity = (at) => {
        context.effectiveEnd = at;
        invoke(context, {
          type: 'damage',
          at,
          actorType: 'summon',
          coefficient: 1,
          metadata: { necromancerShroudSkillOne: true, dhuumfireInterval: duration }
        });
      };

      opportunity(1);
      assert.deepEqual({ ...context.procs.readyAt }, {});
      context.traits.add(trait);
      opportunity(1);
      assert.ok(effects > 0);
      const count = effects;
      opportunity(1 + duration);
      assert.equal(effects, bypass ? count * 2 : count);
      opportunity(1 + duration + 0.000001);
      assert.ok(effects > count);
      assert.equal('traitProcReadyAt' in createNecromancerCoreState(), false);
    }
  });
}

/** Builds the smallest scheduler/resolver context needed to exercise one profession-owned proc gate. */
function professionContext({ id, catalog, core, specialization = {}, kind = 'Core', config = {}, traits = [] }) {
  const events = [];
  const procs = [];
  const conditions = [];
  const context = {
    procs: createProcRegistry(() => context),
    profession: { id },
    catalog,
    config,
    traits: new Set(traits.length ? traits : config.selectedTraitIds || []),
    state: {
      activeWeaponSet: 1,
      profession: {
        core,
        specialization: { kind, state: specialization }
      }
    },
    activeWeaponSet: 1,
    queue: new StableEventQueue(),
    resolved: [],
    boons: new Map(),
    events,
    query: { statsAt: () => ({}) },
    recordProc: (...args) => procs.push(args),
    applyCondition: (event) => conditions.push(event),
    emit(event) {
      events.push(event);
      return event;
    },
    emitDerived(_cause, event) {
      events.push(event);
      return event;
    }
  };
  return { context, events, procs, conditions };
}

test('Elementalist control traits stay blocked at the exact ICD boundary', () => {
  const state = catalystState.create();
  const { context, procs } = professionContext({
    id: 'elementalist',
    catalog: elementalistCatalog,
    core: createElementalistCoreState(),
    specialization: state,
    kind: 'Catalyst',
    traits: [ELEMENTALIST_TRAIT_IDS.VICIOUS_EMPOWERMENT]
  });
  context.procs.readyAt['elementalist.catalyst.viciousEmpowerment'] = READY_AT;
  const event = { type: 'control', actorType: 'player', at: READY_AT, skillName: 'Boundary Control' };

  applyViciousEmpowerment(context, event);
  assert.equal(context.procs.deadline('elementalist.catalyst.viciousEmpowerment'), READY_AT);
  assert.equal(procs.length, 0);

  applyViciousEmpowerment(context, { ...event, at: AFTER_READY_AT });
  assert.ok(context.procs.deadline('elementalist.catalyst.viciousEmpowerment') > AFTER_READY_AT);
  assert.equal(procs.length, 1);
});

test('Engineer condition traits stay blocked at the exact ICD boundary', () => {
  const core = createEngineerCoreState();
  const config = { selectedTraitIds: [ENGINEER_TRAIT_IDS.HEMATIC_FOCUS] };
  const { context } = professionContext({ id: 'engineer', catalog: engineerCatalog, core, config });
  context.procs.readyAt.hematicFocus = READY_AT;
  const event = { type: 'condition', condition: 'Bleeding', actorType: 'player', at: READY_AT };

  reactToEngineerCondition(context, event);
  assert.equal(context.procs.readyAt.hematicFocus, READY_AT);
  assert.equal(context.queue.length, 0);

  reactToEngineerCondition(context, { ...event, at: AFTER_READY_AT });
  assert.ok(context.procs.readyAt.hematicFocus > AFTER_READY_AT);
  assert.equal(context.queue.length, 1);
});

test('Soulbeast stance ICDs preserve the personal One Wolf Pack exception and independent recipients', () => {
  // Only personal One Wolf Pack includes equality; all gates still reject hits before their deadline.
  for (const kind of ['one-wolf-pack', 'vulture-stance']) {
    for (const ally of [false, true]) {
      const state = createSoulbeastState();
      const field = kind === 'one-wolf-pack' ? 'ranger.soulbeast.oneWolfPack' : 'ranger.soulbeast.vultureStance';
      const { context } = professionContext({
        id: 'ranger',
        catalog: rangerCatalog,
        core: createRangerCoreState(),
        specialization: state,
        kind: 'Soulbeast'
      });
      context.procs.readyAt[field] = READY_AT;
      context.procs.readyAt[`ranger.soulbeast.alliedStance:${kind}:1`] = READY_AT;
      context.boons.set(kind, [{ at: 0, expiresAt: 10, stacks: 1, resolvedAudience: { includesSelf: true } }]);
      const react = ally ? soulbeastEventHandlers['ranger.shared-stance-hit'] : reactToSoulbeastDamage;
      const event = {
        type: ally ? 'ranger.shared-stance-hit' : 'damage',
        actorType: 'player',
        source: 'ranger',
        coefficient: 1,
        skillName: 'Attack',
        kind,
        ...(ally ? { metadata: { triggeredByAlly: 1 } } : {})
      };
      const inclusive = !ally && kind === 'one-wolf-pack';
      const blockedTimes = inclusive ? [0.96, READY_AT - 0.000001] : [0.96, READY_AT, READY_AT + 0.0000004];
      for (const at of blockedTimes) react(context, { ...event, at });
      assert.equal(context.queue.length, 0);
      const triggerAt = inclusive ? READY_AT : 1.04;
      react(context, { ...event, at: triggerAt });
      assert.ok(context.queue.length > 0);
      const deadline = ally
        ? context.procs.readyAt[`ranger.soulbeast.alliedStance:${kind}:1`]
        : context.procs.readyAt[field];
      assert.equal(deadline, triggerAt + (kind === 'one-wolf-pack' ? 1 : 0.25));
      if (ally) {
        const queued = context.queue.length;
        react(context, { ...event, at: 1.04, metadata: { triggeredByAlly: 2 } });
        assert.ok(context.queue.length > queued);
        assert.equal(context.procs.readyAt[field], READY_AT);
      }
    }
  }
});

test('Ranger boon traits stay blocked at the exact ICD boundary', () => {
  const state = createSoulbeastState();
  const config = { selectedTraitIds: [RANGER_TRAIT_IDS.ESSENCE_OF_SPEED] };
  const { context } = professionContext({
    id: 'ranger',
    catalog: rangerCatalog,
    core: createRangerCoreState(),
    specialization: state,
    kind: 'Soulbeast',
    config
  });
  context.procs.readyAt['ranger.soulbeast.essenceOfSpeed'] = READY_AT;
  const event = { type: 'buff', kind: 'quickness', at: READY_AT, resolvedAudience: { includesSelf: true } };

  reactToSoulbeastBuff(context, event);
  assert.equal(context.procs.deadline('ranger.soulbeast.essenceOfSpeed'), READY_AT);
  assert.equal(context.queue.length, 0);

  reactToSoulbeastBuff(context, { ...event, at: AFTER_READY_AT });
  assert.ok(context.procs.deadline('ranger.soulbeast.essenceOfSpeed') > AFTER_READY_AT);
  assert.equal(context.queue.length, 1);
});

test('Revenant boon traits stay blocked at the exact ICD boundary', () => {
  const result = runRevenant(
    [wait(2000)],
    {
      specialization: 'Renegade',
      selectedLegends: [REVENANT_LEGEND_IDS.RENEGADE, REVENANT_LEGEND_IDS.ASSASSIN],
      startingLegend: REVENANT_LEGEND_IDS.RENEGADE,
      selectedTraitIds: [REVENANT_TRAIT_IDS.BLOOD_FURY]
    },
    {
      initialize(runtime) {
        runtime.procs.readyAt['revenant.renegade.bloodFury'] = READY_AT;
        for (const at of [READY_AT, AFTER_READY_AT])
          runtime.emit({
            type: 'buff',
            kind: 'fury',
            at,
            duration: 1,
            stacks: 1,
            source: 'fixture',
            sourceId: 'fixture',
            actorType: 'player'
          });
      }
    }
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'buff' && event.sourceId === REVENANT_TRAIT_IDS.BLOOD_FURY)
      .map((event) => event.at),
    [AFTER_READY_AT]
  );
  assert.ok(observedRuntime(result).procs.deadline('revenant.renegade.bloodFury') > AFTER_READY_AT);
});

// Exercise the compiled trigger at real resolver times, including the exclusive cooldown boundary.
test('Thief boon traits stay blocked at the exact ICD boundary', () => {
  const result = runThief(
    [wait(1100)],
    { selectedTraitIds: [THIEF_TRAIT_IDS.ASSASSINS_FURY] },
    {
      initialize(runtime) {
        runtime.procs.readyAt[THIEF_TRAIT_IDS.ASSASSINS_FURY] = READY_AT;
        for (const at of [READY_AT, AFTER_READY_AT])
          runtime.emit({
            type: 'buff',
            kind: 'fury',
            at,
            duration: 1,
            stacks: 1,
            source: 'fixture',
            sourceId: 'fixture',
            actorType: 'player'
          });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events.filter((event) => event.sourceId === THIEF_TRAIT_IDS.ASSASSINS_FURY).map((event) => event.at),
    [AFTER_READY_AT]
  );
  assert.ok(observedRuntime(result).procs.readyAt[THIEF_TRAIT_IDS.ASSASSINS_FURY] > AFTER_READY_AT);
});

// Actual burst impacts share the exclusive trait gate, independently of their skill recharge.
test('Warrior burst traits stay blocked at the exact ICD boundary', () => {
  for (const at of [READY_AT, AFTER_READY_AT]) {
    const config = { specialization: 'Spellbreaker', selectedTraitIds: [WARRIOR_TRAIT_IDS.MAGEBANE_TETHER] };
    const native = warriorProfession.runtimeFor(config);
    const result = observeGw2Runtime({
      config,
      rotation: [{ type: 'wait', durationMs: at * 1000 }],
      profession: {
        ...native,
        initialize(runtime) {
          native.initialize(runtime);
          runtime.profession.specialization.state.magebaneTetherReadyAt = READY_AT;
          runtime.emit({
            type: 'damage',
            at,
            actorType: 'player',
            source: 'warrior',
            sourceId: WARRIOR_SKILL_IDS.BREACHING_STRIKE,
            skillId: WARRIOR_SKILL_IDS.BREACHING_STRIKE,
            coefficient: 1,
            weaponStrengthProfileId: 'weapon.dagger'
          });
        }
      }
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.procSteps.filter((proc) => proc.skill === 'Magebane Tether').length, at === READY_AT ? 0 : 1);
    assert.equal(
      observedRuntime(result).profession.specialization.state.magebaneTetherReadyAt > READY_AT,
      at > READY_AT
    );
  }
});

test('Guardian charge procs stay blocked at the exact ICD boundary', () => {
  const state = createFirebrandState();
  state.ashes.charges = 2;
  state.ashes.expiresAt = 10;
  state.ashes.readyAt = READY_AT;
  const { context, procs, conditions } = professionContext({
    id: 'guardian',
    catalog: guardianCatalog,
    core: createGuardianCoreState(),
    specialization: state,
    kind: 'Firebrand'
  });
  const event = { type: 'damage', actorType: 'player', coefficient: 1, at: READY_AT };

  reactToAshesHit(context, event, { hitContext: {} });
  assert.equal(state.ashes.charges, 2);
  assert.equal(conditions.length, 0);

  reactToAshesHit(context, { ...event, at: AFTER_READY_AT }, { hitContext: {} });
  assert.equal(state.ashes.charges, 1);
  assert.equal(conditions.length, 1);
  assert.equal(procs.length, 1);
});

test('Necromancer condition traits stay blocked at the exact ICD boundary', () => {
  const config = {
    specialization: 'Scourge',
    initialResource: 0,
    selectedTraitIds: [NECROMANCER_TRAIT_IDS.NOURISHING_ASHES]
  };
  const native = necromancerProfession.runtimeFor(config);
  for (const at of [READY_AT, AFTER_READY_AT]) {
    const result = observeGw2Runtime({
      config,
      rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: at * 1000 }],
      profession: {
        ...native,
        initialize(runtime) {
          native.initialize(runtime);
          runtime.procs.readyAt['necromancer.scourge.nourishingAshes'] = READY_AT;
          runtime.emit({
            type: 'condition',
            condition: 'Burning',
            stacks: 1,
            duration: 1,
            at,
            source: 'test',
            sourceId: 'burning',
            actorType: 'player'
          });
        }
      }
    });
    assert.equal(
      observedRuntime(result).procs.deadline('necromancer.scourge.nourishingAshes') > READY_AT,
      at === AFTER_READY_AT
    );
    assert.deepEqual(result.warnings, []);
  }
});

// Defiant interrupts claim before nested condition reactions; ordinary interrupts never consume an ICD.
test('Ineptitude claims only surviving effects on defiant targets at the event timestamp', () => {
  const trait = MESMER_TRAIT_IDS.INEPTITUDE;
  const key = 'mesmer.core.ineptitude';
  for (const defiant of [false, true]) {
    for (const duration of [0, 2]) {
      const catalog = withProfile(mesmerCatalog, trait, { internalCooldown: duration });
      const { context, conditions } = professionContext({
        id: 'mesmer',
        catalog,
        core: {},
        traits: [trait],
        config: { target: { defiant, activatingSkills: true } }
      });
      context.time = 99;
      const event = { type: 'control', actorType: 'player', at: 1, skillName: 'Interrupt' };
      context.catalog = withProfile(catalog, trait, {
        effects: [],
        removedEffectKeys: [JSON.stringify(['condition', 'Confusion'])]
      });
      triggerIneptitudeFromInterrupt(context, event);
      assert.deepEqual({ ...context.procs.readyAt }, {});
      assert.equal(conditions.length, 0);
      context.catalog = catalog;
      context.applyCondition = (condition) => {
        conditions.push(condition);
        assert.equal(context.procs.readyAt[key], defiant ? condition.at + duration : undefined);
        if (defiant && conditions.length === 1) triggerIneptitudeFromInterrupt(context, event);
      };

      triggerIneptitudeFromInterrupt(context, event);
      assert.equal(conditions.length, 1);
      triggerIneptitudeFromInterrupt(context, { ...event, at: 1 + duration });
      assert.equal(conditions.length, defiant ? 1 : 2);
      triggerIneptitudeFromInterrupt(context, { ...event, at: 1 + duration + 0.000001 });
      assert.equal(conditions.length, defiant ? 2 : 3);
    }
  }
});

// Non-ICD profile fields keep their own duration, and removed effects must leave the proc ready.
test('Demonic Lore claims its cooldown field only for a surviving Burning packet', () => {
  const id = NECROMANCER_TRAIT_IDS.DEMONIC_LORE;
  const catalog = withProfile(necromancerCatalog, id, { cooldown: 2, internalCooldown: 99 });
  const { context, conditions } = professionContext({
    id: 'necromancer',
    catalog,
    core: createNecromancerCoreState(),
    traits: [NECROMANCER_TRAIT_IDS.DEMONIC_LORE]
  });
  const key = 'necromancer.scourge.demonicLore';
  const event = { type: 'condition', condition: 'Torment', at: 1, actorType: 'player' };
  context.catalog = withProfile(catalog, id, {
    effects: [],
    removedEffectKeys: [JSON.stringify(['condition', 'Burning'])]
  });
  scourgeResolverEventReactions.condition(context, event);
  assert.deepEqual({ ...context.procs.readyAt }, {});
  context.catalog = catalog;
  context.applyCondition = (condition) => {
    assert.equal(context.procs.deadline(key), condition.at + 2);
    conditions.push(condition);
    if (conditions.length === 1) scourgeResolverEventReactions.condition(context, event);
  };

  scourgeResolverEventReactions.condition(context, event);
  assert.equal(conditions.length, 1);
  scourgeResolverEventReactions.condition(context, { ...event, at: 3 });
  assert.equal(conditions.length, 1);
  scourgeResolverEventReactions.condition(context, { ...event, at: 3.000001 });
  assert.equal(conditions.length, 2);
});

// Summons have independent claims; spirit hits share the player's interval and pre-timed allied hits bypass it.
test('Vampiric Presence preserves recipient scopes and the pre-applied interval bypass', () => {
  const core = createNecromancerCoreState();
  core.activeMinions.fixture = 2;
  const catalog = withProfile(necromancerCatalog, NECROMANCER_TRAIT_IDS.VAMPIRIC_PRESENCE, {
    cooldown: 2
  });
  const { context } = professionContext({
    id: 'necromancer',
    catalog,
    core,
    traits: [NECROMANCER_TRAIT_IDS.VAMPIRIC_PRESENCE],
    config: { allies: { count: 0 } }
  });
  const event = { type: 'damage', actorType: 'player', coefficient: 1, at: 1 };
  applyVampiricPresence(context, event);
  applyVampiricPresence(context, { ...event, actorType: 'summon', summonKind: 'spirit' });
  assert.equal(context.queue.length, 1);
  for (const index of [0, 1, 0]) {
    applyVampiricPresence(context, { ...event, actorType: 'summon', summonOwner: `minion:fixture:${index}` });
  }

  assert.equal(context.queue.length, 3);
  assert.deepEqual(
    { ...context.procs.readyAt },
    {
      'necromancer.core.vampiricPresence': 3,
      'vampiricPresence:minion:fixture:0': 3,
      'vampiricPresence:minion:fixture:1': 3
    }
  );
  context.procs.readyAt['vampiricPresence:ally:1'] = 10;
  reactToVampiricPresenceAlliedHit(context, { ...event, allyIndex: 1 });
  assert.equal(context.queue.length, 4);
  assert.equal(context.procs.readyAt['vampiricPresence:ally:1'], 10);
});

// Repeated and invalid recipient IDs cannot consume another ally's independent interval.
test('Dark Sentry claims each eligible ally once and retains strict recipient deadlines', () => {
  const runtime = observedRuntime(
    runThief([], { specialization: 'Specter', allies: { count: 2, strikesPerSecond: 0 } })
  );
  const invoke = specterModule.hooks.tasks['thief.specter-dark-sentry'];
  runtime.time = 1;
  runtime.procs.readyAt['thief.specter.darkSentry:1'] = 1;
  invoke(runtime, { allyIndices: [0, 1, 2, 2, 3, 1.5] });
  assert.equal(runtime.procs.deadline('thief.specter.darkSentry:1'), 1);
  const secondDeadline = runtime.procs.deadline('thief.specter.darkSentry:2');
  assert.ok(secondDeadline > 1);
  assert.deepEqual(Object.keys(runtime.procs.readyAt).sort(), [
    'thief.specter.darkSentry:1',
    'thief.specter.darkSentry:2'
  ]);
  runtime.time = 1.000001;
  invoke(runtime, { allyIndices: [1, 2] });
  assert.ok(runtime.procs.deadline('thief.specter.darkSentry:1') > 1.000001);
  assert.equal(runtime.procs.deadline('thief.specter.darkSentry:2'), secondDeadline);
});
