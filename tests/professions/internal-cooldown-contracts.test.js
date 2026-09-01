import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistCatalog } from '#gw2/content/professions/elementalist/catalog.js';
import { createElementalistCoreState } from '#gw2/content/professions/elementalist/core/state.js';
import { applyViciousEmpowerment } from '#gw2/content/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { createCatalystState } from '#gw2/content/professions/elementalist/specializations/catalyst/state.js';
import { engineerCatalog } from '#gw2/content/professions/engineer/catalog.js';
import { createEngineerCoreState } from '#gw2/content/professions/engineer/core/state.js';
import { reactToEngineerCondition } from '#gw2/content/professions/engineer/core/traits/index.js';
import { ENGINEER_TRAIT_IDS } from '#gw2/content/professions/engineer/data/ids.js';
import { guardianCatalog } from '#gw2/content/professions/guardian/catalog.js';
import { createGuardianCoreState } from '#gw2/content/professions/guardian/core/state.js';
import { reactToAshesHit } from '#gw2/content/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { createFirebrandState } from '#gw2/content/professions/guardian/specializations/firebrand/state.js';
import { necromancerCatalog } from '#gw2/content/professions/necromancer/catalog.js';
import { createNecromancerCoreState } from '#gw2/content/professions/necromancer/core/state.js';
import { NECROMANCER_TRAIT_IDS } from '#gw2/content/professions/necromancer/data/ids.js';
import { scourgeSchedulerHooks } from '#gw2/content/professions/necromancer/specializations/scourge/mechanics/shade-rules.js';
import { createScourgeState } from '#gw2/content/professions/necromancer/specializations/scourge/state.js';
import { rangerCatalog } from '#gw2/content/professions/ranger/catalog.js';
import { createRangerCoreState } from '#gw2/content/professions/ranger/core/state.js';
import { RANGER_TRAIT_IDS } from '#gw2/content/professions/ranger/data/ids.js';
import { reactToSoulbeastBuff } from '#gw2/content/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { createSoulbeastState } from '#gw2/content/professions/ranger/specializations/soulbeast/state.js';
import { revenantCatalog } from '#gw2/content/professions/revenant/catalog.js';
import { createRevenantCoreState } from '#gw2/content/professions/revenant/core/state.js';
import { REVENANT_TRAIT_IDS } from '#gw2/content/professions/revenant/data/ids.js';
import { createRenegadeState } from '#gw2/content/professions/revenant/specializations/renegade/state.js';
import { observeRenegadeTraits } from '#gw2/content/professions/revenant/specializations/renegade/traits/index.js';
import { thiefCatalog } from '#gw2/content/professions/thief/catalog.js';
import { createThiefCoreState } from '#gw2/content/professions/thief/core/state.js';
import { reactToThiefCoreBuff } from '#gw2/content/professions/thief/core/traits/index.js';
import { THIEF_TRAIT_IDS } from '#gw2/content/professions/thief/data/ids.js';
import { warriorCatalog } from '#gw2/content/professions/warrior/catalog.js';
import { createWarriorCoreState } from '#gw2/content/professions/warrior/core/state.js';
import { WARRIOR_TRAIT_IDS } from '#gw2/content/professions/warrior/data/ids.js';
import { createSpellbreakerState } from '#gw2/content/professions/warrior/specializations/spellbreaker/state.js';
import { reactToSpellbreakerDamage } from '#gw2/content/professions/warrior/specializations/spellbreaker/traits/index.js';

const READY_AT = 1;
const AFTER_READY_AT = 1.001;

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
    epsilon: 0.0001,
    queue: [],
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
  const state = createCatalystState();
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
  const event = { type: 'buff', kind: 'quickness', at: READY_AT };

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
  state.ashesCharges = 2;
  state.ashesExpiresAt = 10;
  state.ashesNextTriggerAt = READY_AT;
  const { context, procs, conditions } = professionContext({
    id: 'guardian',
    catalog: guardianCatalog,
    core: createGuardianCoreState(),
    specialization: state,
    kind: 'Firebrand'
  });
  const event = { type: 'damage', actorType: 'player', coefficient: 1, at: READY_AT };

  reactToAshesHit(context, event, { hitContext: {} });
  assert.equal(state.ashesCharges, 2);
  assert.equal(conditions.length, 0);

  reactToAshesHit(context, { ...event, at: AFTER_READY_AT }, { hitContext: {} });
  assert.equal(state.ashesCharges, 1);
  assert.equal(conditions.length, 1);
  assert.equal(procs.length, 1);
});

test('Necromancer condition traits stay blocked at the exact ICD boundary', () => {
  const state = createScourgeState();
  state.nourishingAshesReadyAt = READY_AT;
  const config = { initialResource: 0, selectedTraitIds: [NECROMANCER_TRAIT_IDS.NOURISHING_ASHES] };
  const { context } = professionContext({
    id: 'necromancer',
    catalog: necromancerCatalog,
    core: createNecromancerCoreState(config),
    specialization: state,
    kind: 'Scourge',
    config
  });
  const event = { type: 'condition', condition: 'Burning', at: READY_AT };

  scourgeSchedulerHooks.onEventScheduled.handler(context, event);
  assert.equal(state.nourishingAshesReadyAt, READY_AT);

  scourgeSchedulerHooks.onEventScheduled.handler(context, { ...event, at: AFTER_READY_AT });
  assert.ok(state.nourishingAshesReadyAt > AFTER_READY_AT);
});
