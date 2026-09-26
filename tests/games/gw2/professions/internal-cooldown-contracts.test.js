import { observeGw2Runtime, runtimeFor } from '#tests/helpers/live-runtime.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { applyViciousEmpowerment } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { reactToEngineerCondition } from '#gw2/professions/engineer/core/traits/index.js';
import { ENGINEER_TRAIT_IDS } from '#gw2/professions/engineer/data/ids.js';
import { guardianCatalog } from '#gw2/professions/guardian/profession.js';
import { createGuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { reactToAshesHit } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { createFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import {
  reactToNecromancerCoreDamage,
  reactToNecromancerBlind
} from '#gw2/professions/necromancer/core/traits/index.js';
import { NECROMANCER_TRAIT_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { RANGER_TRAIT_IDS } from '#gw2/professions/ranger/data/ids.js';
import {
  reactToSoulbeastBuff,
  reactToSoulbeastDamage,
  soulbeastEventHandlers
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { createSoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { REVENANT_LEGEND_IDS, REVENANT_TRAIT_IDS, REVENANT_SKILL_IDS } from '#gw2/professions/revenant/data/ids.js';
import { revenantHit, runRevenant } from '#tests/helpers/revenant-simulation.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { createThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { reactThiefCoreBuff } from '#gw2/professions/thief/core/traits/index.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS, WARRIOR_SKILL_IDS } from '#gw2/professions/warrior/data/ids.js';

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
              REVENANT_SKILL_IDS.SWAP_WEAPONS,
              {
                cooldown: 0
              }
            )
        }
      );
    assert.deepEqual(runtimeFor(run([])).profession.core.traitProcReadyAt, {});
    const result = run([REVENANT_TRAIT_IDS.BRUTALITY]);
    assert.deepEqual(result.warnings, []);
    // The swap at the exact deadline is blocked; one millisecond later claims again from its own completion.
    assert.deepEqual(
      result.events
        .filter((event) => event.type === 'buff' && event.skillId === REVENANT_TRAIT_IDS.BRUTALITY)
        .map((event) => event.at),
      [1, 1 + duration + 0.001]
    );
    closeTo(runtimeFor(result).profession.core.traitProcReadyAt.brutality, 1 + duration + 0.001 + duration);
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
    assert.deepEqual(runtimeFor(run([])).profession.core.traitProcReadyAt, {});
    assert.deepEqual(might(run([REVENANT_TRAIT_IDS.VICIOUS_REPRISAL], {})), []);
    const result = run([REVENANT_TRAIT_IDS.VICIOUS_REPRISAL]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      might(result).map((event) => event.at),
      [1, 1 + duration + 0.001]
    );
    closeTo(runtimeFor(result).profession.core.traitProcReadyAt.viciousReprisal, 1 + duration + 0.001 + duration);
  }
});

// Heal traits claim from the actual completion timestamp, with the shared strict cooldown boundary.
for (const [key, trait] of [
  ['darkDefense', NECROMANCER_TRAIT_IDS.DARK_DEFENSE],
  ['maliciousSwarm', NECROMANCER_TRAIT_IDS.MALICIOUS_SWARM]
]) {
  test(`Necromancer ${key} claims only after its live completion boundary`, () => {
    for (const selected of [false, true])
      for (const completion of [1, 1.000001]) {
        const config = { specialization: 'Core', selectedTraitIds: selected ? [trait] : [] };
        const native = necromancerProfession.liveRuntimeFor(config);
        const result = observeGw2Runtime({
          config,
          rotation: [{ type: 'wait', durationMs: completion * 1000 - 680 }, 'Well of Blood'],
          profession: {
            ...native,
            initialize(runtime) {
              native.initialize(runtime);
              runtime.profession.core.traitProcReadyAt[key] = 1;
            }
          }
        });
        assert.equal(runtimeFor(result).profession.core.traitProcReadyAt[key] > 1, selected && completion > 1);
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
        assert.equal(core.traitProcReadyAt[key], bypass ? undefined : event.at + duration);
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
      assert.deepEqual(core.traitProcReadyAt, {});
      context.traits.add(trait);
      opportunity(1);
      assert.ok(effects > 0);
      const count = effects;
      opportunity(1 + duration);
      assert.equal(effects, bypass ? count * 2 : count);
      opportunity(1 + duration + 0.000001);
      assert.ok(effects > count);
      assert.deepEqual(createNecromancerCoreState().traitProcReadyAt, {});
    }
  });
}

/** Builds the smallest scheduler/resolver context needed to exercise one profession-owned proc gate. */
function professionContext({ id, catalog, core, specialization = {}, kind = 'Core', config = {}, traits = [] }) {
  const events = [];
  const procs = [];
  const conditions = [];
  const context = {
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
  state.viciousEmpowermentReadyAt = READY_AT;
  const { context, procs } = professionContext({
    id: 'elementalist',
    catalog: elementalistCatalog,
    core: createElementalistCoreState(),
    specialization: state,
    kind: 'Catalyst',
    traits: ['Vicious Empowerment']
  });
  const event = { type: 'control', actorType: 'player', at: READY_AT, skillName: 'Boundary Control' };

  applyViciousEmpowerment(context, event);
  assert.equal(state.viciousEmpowermentReadyAt, READY_AT);
  assert.equal(procs.length, 0);

  applyViciousEmpowerment(context, { ...event, at: AFTER_READY_AT });
  assert.ok(state.viciousEmpowermentReadyAt > AFTER_READY_AT);
  assert.equal(procs.length, 1);
});

test('Engineer condition traits stay blocked at the exact ICD boundary', () => {
  const core = createEngineerCoreState();
  core.traitProcReadyAt.hematicFocus = READY_AT;
  const config = { selectedTraitIds: [ENGINEER_TRAIT_IDS.HEMATIC_FOCUS] };
  const { context } = professionContext({ id: 'engineer', catalog: engineerCatalog, core, config });
  const event = { type: 'condition', condition: 'Bleeding', actorType: 'player', at: READY_AT };

  reactToEngineerCondition(context, event);
  assert.equal(core.traitProcReadyAt.hematicFocus, READY_AT);
  assert.equal(context.queue.length, 0);

  reactToEngineerCondition(context, { ...event, at: AFTER_READY_AT });
  assert.ok(core.traitProcReadyAt.hematicFocus > AFTER_READY_AT);
  assert.equal(context.queue.length, 1);
});

test('Soulbeast stance ICDs preserve the personal One Wolf Pack exception and independent recipients', () => {
  // Only personal One Wolf Pack includes equality; all gates still reject hits before their deadline.
  for (const kind of ['one-wolf-pack', 'vulture-stance']) {
    for (const ally of [false, true]) {
      const state = createSoulbeastState();
      const field = kind === 'one-wolf-pack' ? 'oneWolfPackReadyAt' : 'vultureStanceReadyAt';
      state[field] = READY_AT;
      state.alliedStanceReadyAt[`${kind}:1`] = READY_AT;
      const { context } = professionContext({
        id: 'ranger',
        catalog: rangerCatalog,
        core: createRangerCoreState(),
        specialization: state,
        kind: 'Soulbeast'
      });
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
      const deadline = ally ? state.alliedStanceReadyAt[`${kind}:1`] : state[field];
      assert.equal(deadline, triggerAt + (kind === 'one-wolf-pack' ? 1 : 0.25));
      if (ally) {
        const queued = context.queue.length;
        react(context, { ...event, at: 1.04, metadata: { triggeredByAlly: 2 } });
        assert.ok(context.queue.length > queued);
        assert.equal(state[field], READY_AT);
      }
    }
  }
});

test('Ranger boon traits stay blocked at the exact ICD boundary', () => {
  const state = createSoulbeastState();
  state.essenceOfSpeedReadyAt = READY_AT;
  const config = { selectedTraitIds: [RANGER_TRAIT_IDS.ESSENCE_OF_SPEED] };
  const { context } = professionContext({
    id: 'ranger',
    catalog: rangerCatalog,
    core: createRangerCoreState(),
    specialization: state,
    kind: 'Soulbeast',
    config
  });
  const event = { type: 'buff', kind: 'quickness', at: READY_AT, resolvedAudience: { includesSelf: true } };

  reactToSoulbeastBuff(context, event);
  assert.equal(state.essenceOfSpeedReadyAt, READY_AT);
  assert.equal(context.queue.length, 0);

  reactToSoulbeastBuff(context, { ...event, at: AFTER_READY_AT });
  assert.ok(state.essenceOfSpeedReadyAt > AFTER_READY_AT);
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
        runtime.profession.specialization.state.bloodFuryReadyAt = READY_AT;
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
  assert.ok(runtimeFor(result).profession.specialization.state.bloodFuryReadyAt > AFTER_READY_AT);
});

test('Thief boon traits stay blocked at the exact ICD boundary', () => {
  const core = createThiefCoreState();
  core.traitProcReadyAt[THIEF_TRAIT_IDS.ASSASSINS_FURY] = READY_AT;
  const config = { selectedTraitIds: [THIEF_TRAIT_IDS.ASSASSINS_FURY] };
  const { context } = professionContext({ id: 'thief', catalog: thiefCatalog, core, config });
  const event = {
    type: 'buff',
    kind: 'fury',
    at: READY_AT,
    resolvedAudience: {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 0,
      companionIds: [],
      recipientCount: 1
    }
  };

  reactThiefCoreBuff(context, event);
  assert.equal(core.traitProcReadyAt[THIEF_TRAIT_IDS.ASSASSINS_FURY], READY_AT);
  assert.equal(context.queue.length, 0);

  reactThiefCoreBuff(context, { ...event, at: AFTER_READY_AT });
  assert.ok(core.traitProcReadyAt[THIEF_TRAIT_IDS.ASSASSINS_FURY] > AFTER_READY_AT);
  assert.equal(context.queue.length, 1);
});

// Actual burst impacts share the exclusive trait gate, independently of their skill recharge.
test('Warrior burst traits stay blocked at the exact ICD boundary', () => {
  for (const at of [READY_AT, AFTER_READY_AT]) {
    const config = { specialization: 'Spellbreaker', selectedTraitIds: [WARRIOR_TRAIT_IDS.MAGEBANE_TETHER] };
    const native = warriorProfession.liveRuntimeFor(config);
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
    assert.equal(runtimeFor(result).profession.specialization.state.magebaneTetherReadyAt > READY_AT, at > READY_AT);
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
  const native = necromancerProfession.liveRuntimeFor(config);
  for (const at of [READY_AT, AFTER_READY_AT]) {
    const result = observeGw2Runtime({
      config,
      rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: at * 1000 }],
      profession: {
        ...native,
        initialize(runtime) {
          native.initialize(runtime);
          runtime.profession.specialization.state.nourishingAshesReadyAt = READY_AT;
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
      runtimeFor(result).profession.specialization.state.nourishingAshesReadyAt > READY_AT,
      at === AFTER_READY_AT
    );
    assert.deepEqual(result.warnings, []);
  }
});
