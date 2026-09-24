import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
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
import { applyMaliciousSwarm } from '#gw2/professions/necromancer/core/traits/spite.js';
import { applyDarkDefense } from '#gw2/professions/necromancer/core/traits/death-magic.js';
import {
  reactToNecromancerCoreDamage,
  reactToNecromancerBlind
} from '#gw2/professions/necromancer/core/traits/index.js';
import { NECROMANCER_TRAIT_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { RANGER_TRAIT_IDS } from '#gw2/professions/ranger/data/ids.js';
import { reactToSoulbeastBuff } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { createSoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { revenantCatalog } from '#gw2/professions/revenant/profession.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_TRAIT_IDS, REVENANT_SKILL_IDS } from '#gw2/professions/revenant/data/ids.js';
import { observeRevenantEvent } from '#gw2/professions/revenant/core/mechanics/scheduler-hooks.js';
import { createRenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { observeRenegadeTraits } from '#gw2/professions/revenant/specializations/renegade/traits/index.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { createThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { reactToThiefCoreBuff } from '#gw2/professions/thief/core/traits/index.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import { warriorCatalog } from '#gw2/professions/warrior/profession.js';
import { createWarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import { WARRIOR_TRAIT_IDS } from '#gw2/professions/warrior/data/ids.js';
import { createSpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { reactToSpellbreakerDamage } from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';

const READY_AT = 1;
const AFTER_READY_AT = 1.001;

// The scheduler dispatcher owns strike classification; swap claims use completion time for both event forms.
for (const [key, trait, event] of [
  [
    'brutality',
    REVENANT_TRAIT_IDS.BRUTALITY,
    { type: 'action', skillId: REVENANT_SKILL_IDS.SWAP_WEAPONS, at: 0, endsAt: 1 }
  ],
  ['brutality', REVENANT_TRAIT_IDS.BRUTALITY, { type: 'sigil_swap', skillId: REVENANT_SKILL_IDS.SWAP_WEAPONS, at: 1 }],
  [
    'viciousReprisal',
    REVENANT_TRAIT_IDS.VICIOUS_REPRISAL,
    { type: 'damage', actorType: 'player', coefficient: 1, at: 1 }
  ]
]) {
  test(`Revenant ${key} ${event.type} preserves eligibility and completion-time claims`, () => {
    for (const duration of [2, 0]) {
      const core = createRevenantCoreState();
      const { context, events } = professionContext({ id: 'revenant', catalog: revenantCatalog, core });
      const profiles = new Map(revenantCatalog.balanceProfilesById);
      profiles.set(trait, { ...profiles.get(trait), cooldown: duration });
      context.catalog = { ...revenantCatalog, balanceProfilesById: profiles };
      context.hasBuff = () => false;
      context.tasks = { schedule() {} };
      observeRevenantEvent(context, event);
      assert.deepEqual(core.traitProcReadyAt, {});
      context.config.selectedTraitIds = [trait];
      if (key === 'viciousReprisal') {
        observeRevenantEvent(context, event);
        assert.deepEqual(core.traitProcReadyAt, {});
        context.hasBuff = () => true;
        observeRevenantEvent(context, { ...event, actorType: 'summon' });
        observeRevenantEvent(context, { ...event, coefficient: 0 });
        assert.deepEqual(core.traitProcReadyAt, {});
      }

      const emit = context.emitDerived.bind(context);
      context.emitDerived = (cause, output) => {
        assert.equal(core.traitProcReadyAt[key], output.at + duration);
        return emit(cause, output);
      };

      observeRevenantEvent(context, event);
      assert.equal(events.length, 1);
      for (const at of [1 + duration, 1 + duration + 0.000001]) {
        observeRevenantEvent(context, { ...event, at, ...(event.endsAt == null ? {} : { endsAt: at }) });
      }

      assert.equal(events.length, 2);
      assert.equal(core.traitProcReadyAt[key], 1 + duration + 0.000001 + duration);
    }
  });
}

// Keep map claims behind local eligibility, with Dhuumfire's explicit zero-interval bypass intact.
for (const [key, trait, invoke, literalDuration] of [
  ['siphonedPower', NECROMANCER_TRAIT_IDS.SIPHONED_POWER, reactToNecromancerCoreDamage],
  ['chillOfDeath', NECROMANCER_TRAIT_IDS.CHILL_OF_DEATH, reactToNecromancerCoreDamage],
  ['chillingDarkness', NECROMANCER_TRAIT_IDS.CHILLING_DARKNESS, reactToNecromancerBlind],
  [
    'darkDefense',
    NECROMANCER_TRAIT_IDS.DARK_DEFENSE,
    (c) => applyDarkDefense(c, { id: 1, name: 'Heal', type: 'Heal' }),
    5
  ],
  [
    'maliciousSwarm',
    NECROMANCER_TRAIT_IDS.MALICIOUS_SWARM,
    (c) => applyMaliciousSwarm(c, { id: 1, name: 'Heal', type: 'Heal' }),
    15
  ],
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
  const state = createRenegadeState();
  state.bloodFuryReadyAt = READY_AT;
  const config = { selectedTraitIds: [REVENANT_TRAIT_IDS.BLOOD_FURY] };
  const { context } = professionContext({
    id: 'revenant',
    catalog: revenantCatalog,
    core: createRevenantCoreState(),
    specialization: state,
    kind: 'Renegade',
    config
  });
  const event = { type: 'buff', kind: 'fury', at: READY_AT };

  observeRenegadeTraits(context, event);
  assert.equal(state.bloodFuryReadyAt, READY_AT);
  assert.equal(state.kallasFervor.length, 0);

  observeRenegadeTraits(context, { ...event, at: AFTER_READY_AT });
  assert.ok(state.bloodFuryReadyAt > AFTER_READY_AT);
  assert.equal(state.kallasFervor.length, 1);
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

  reactToThiefCoreBuff(context, event);
  assert.equal(core.traitProcReadyAt[THIEF_TRAIT_IDS.ASSASSINS_FURY], READY_AT);
  assert.equal(context.queue.length, 0);

  reactToThiefCoreBuff(context, { ...event, at: AFTER_READY_AT });
  assert.ok(core.traitProcReadyAt[THIEF_TRAIT_IDS.ASSASSINS_FURY] > AFTER_READY_AT);
  assert.equal(context.queue.length, 1);
});

test('Warrior burst traits stay blocked at the exact ICD boundary', () => {
  const state = createSpellbreakerState();
  state.magebaneTetherReadyAt = READY_AT;
  const { context, procs } = professionContext({
    id: 'warrior',
    catalog: warriorCatalog,
    core: createWarriorCoreState(),
    specialization: state,
    kind: 'Spellbreaker',
    traits: [WARRIOR_TRAIT_IDS.MAGEBANE_TETHER]
  });
  context.query = { timeline: createGw2TimelineIndex() };
  context.helpers = { skillsById: new Map([[900001, { id: 900001, name: 'Boundary Burst', burst: true }]]) };
  const event = { type: 'damage', actorType: 'player', coefficient: 1, skillId: 900001, at: READY_AT };

  reactToSpellbreakerDamage(context, event);
  assert.equal(state.magebaneTetherReadyAt, READY_AT);
  assert.equal(procs.length, 0);

  reactToSpellbreakerDamage(context, { ...event, at: AFTER_READY_AT });
  assert.ok(state.magebaneTetherReadyAt > AFTER_READY_AT);
  assert.equal(procs.length, 1);
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
  const { context } = createScheduler({
    profession: necromancerProfession,
    config: {
      specialization: 'Scourge',
      initialResource: 0,
      selectedTraitIds: [NECROMANCER_TRAIT_IDS.NOURISHING_ASHES]
    }
  });
  const state = context.state.profession.specialization.state;
  state.nourishingAshesReadyAt = READY_AT;
  for (const at of [READY_AT, AFTER_READY_AT]) {
    context.emit({
      type: 'condition',
      condition: 'Burning',
      stacks: 1,
      duration: 1,
      at,
      source: 'test',
      sourceId: 'burning',
      actorType: 'player'
    });
    context.advanceTo(at);
    assert.equal(state.nourishingAshesReadyAt > READY_AT, at === AFTER_READY_AT);
  }
});
