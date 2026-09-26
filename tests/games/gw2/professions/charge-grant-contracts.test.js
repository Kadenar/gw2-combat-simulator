import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { ENGINEER_TRAIT_IDS as ENGINEER } from '#gw2/professions/engineer/data/ids.js';
import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import {
  applyElementalistResolverBuff,
  applyElementalistResolvedDamage
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import {
  holosmithResolverEventHandlers,
  consumeSolarFocusingLens
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge-effects.js';
import {
  handleRangerPoisonousStrikes,
  handleRangerBloodThirst
} from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import { rangerCoreLive } from '#gw2/professions/ranger/core/live.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { triggerPoisonousStrikes } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { reactToSoulbeastDamage } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { antiquaryResolverEventReactions } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifact-effects.js';
import { projectThiefPlanningState } from '#gw2/professions/thief/family-state.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Real state owners and catalogs isolate grant contracts without relying on saved rotation packets.
function contextFor(profession, specialization, selectedTraitIds = []) {
  const config = { specialization, selectedTraitIds };
  const runtime = profession.resolveRuntime(config);
  const state = runtime.createState(config);
  const events = [];
  const emit = (event) => {
    events.push(event);
    return event;
  };

  return {
    config,
    profession: state,
    catalog: runtime.catalog,
    helpers: runtime.catalog,
    state: { time: 0, profession: state, cooldowns: new Map() },
    events,
    emit,
    emitDerived: (_cause, event) => emit(event),
    queue: { enqueue: emit },
    applyCondition: emit,
    boons: new Map(),
    recordProc() {},
    cooldownController: { reduceSkillRecharge() {} },
    start: 0,
    effectiveEnd: 1
  };
}

test('Shattering Stone replaces self grants and spends player or effect hits before exclusive expiry', () => {
  const context = contextFor(elementalistProfession, 'Core');
  const core = context.profession.core;
  const grant = { kind: 'shattering stone', at: 1, stacks: 2, duration: 2, resolvedAudience: { includesSelf: true } };
  applyElementalistResolverBuff(context, { ...grant, resolvedAudience: { includesSelf: false } });
  assert.equal(core.shatteringStone.charges, 0);
  applyElementalistResolverBuff(context, grant);
  for (const event of [
    { actorType: 'summon', coefficient: 1 },
    { actorType: 'player', coefficient: 0 }
  ]) {
    applyElementalistResolvedDamage(context, { at: 2, ...event });
  }

  assert.equal(core.shatteringStone.charges, 2);
  applyElementalistResolvedDamage(context, { at: 2, actorType: 'effect', coefficient: 1 });
  assert.equal(core.shatteringStone.charges, 1);
  assert.equal(context.events[0].condition, 'Bleeding');
  assert.equal(context.events[0].at, 2);
  applyElementalistResolverBuff(context, { ...grant, at: 2 });
  assert.equal(core.shatteringStone.charges, 2);
  assert.equal(core.shatteringStone.expiresAt, 4);
  applyElementalistResolvedDamage(context, { at: 3, actorType: 'player', coefficient: 1 });
  applyElementalistResolvedDamage(context, { at: 4, actorType: 'player', coefficient: 1 });
  assert.equal(core.shatteringStone.charges, 1);
});

test('Poisonous Strikes shares one inclusive-expiry grant across pet and Beastmode routes', () => {
  const context = contextFor(rangerProfession, 'Soulbeast');
  const core = context.profession.core;
  const merged = context.profession.specialization.state;
  merged.beastmodeActive = false;
  const pet = { at: 2, source: 'ranger-pet', actorType: 'summon', coefficient: 1, skillName: 'Pet strike' };
  const player = { ...pet, source: 'ranger', actorType: 'player', skillName: 'Player strike' };
  handleRangerPoisonousStrikes(context, { at: 1, charges: 3, duration: 2 });
  triggerPoisonousStrikes(context, player);
  reactToSoulbeastDamage(context, player);
  triggerPoisonousStrikes(context, { ...pet, coefficient: 0 });
  assert.equal(core.poisonousStrikes.charges, 3);
  triggerPoisonousStrikes(context, pet);
  assert.equal(core.poisonousStrikes.charges, 2);
  merged.beastmodeActive = true;
  reactToSoulbeastDamage(context, player);
  assert.equal(core.poisonousStrikes.charges, 1);
  assert.equal(context.events[0].source, 'ranger-pet');
  assert.equal(context.events[0].independentConditionOwner, true);
  assert.equal(context.events[1].source, 'ranger');
  assert.equal(context.events[1].independentConditionOwner, undefined);
  handleRangerPoisonousStrikes(context, { at: 2, charges: 2, duration: 1 });
  assert.equal(core.poisonousStrikes.charges, 2);
  triggerPoisonousStrikes(context, { ...pet, at: 3 });
  reactToSoulbeastDamage(context, { ...player, at: 3 });
  assert.equal(core.poisonousStrikes.charges, 0);
  handleRangerPoisonousStrikes(context, { at: 3, charges: 2, duration: 1 });
  triggerPoisonousStrikes(context, { ...pet, at: 4.001 });
  assert.equal(core.poisonousStrikes.charges, 0);
  assert.equal(context.events.length, 4);
});

test('Blood Thirst grants twelve seconds, replaces remaining charges, and respects strike eligibility', () => {
  const context = contextFor(rangerProfession, 'Core');
  const core = context.profession.core;
  const skill = context.catalog.skillsById.get(RANGER.CRIPPLING_SHOT);
  const grant = (at) => {
    context.time = at;
    rangerCoreLive.onCastComplete(context, { skill, start: at, fullEnd: at, effectiveEnd: at });
    const event = context.events.at(-1);
    assert.equal(event.duration, 12);
    handleRangerBloodThirst(context, event);
  };

  grant(1);
  assert.equal(core.bloodThirst.charges, 3);
  assert.equal(core.bloodThirst.expiresAt, 13);
  const hit = { at: 2, source: 'ranger', actorType: 'player', coefficient: 1 };
  for (const fields of [
    { sourceId: skill.id },
    { actorType: 'effect' },
    { coefficient: 0 },
    { coefficient: undefined }
  ]) {
    reactToRangerCoreDamage(context, { ...hit, ...fields });
  }

  assert.equal(core.bloodThirst.charges, 3);
  reactToRangerCoreDamage(context, hit);
  assert.equal(core.bloodThirst.charges, 2);
  assert.equal(context.events.at(-1).condition, 'Bleeding');
  grant(2);
  assert.equal(core.bloodThirst.charges, 3);
  assert.equal(core.bloodThirst.expiresAt, 14);
  reactToRangerCoreDamage(context, { ...hit, at: 13.999 });
  assert.equal(core.bloodThirst.charges, 2);
  const count = context.events.length;
  reactToRangerCoreDamage(context, { ...hit, at: 14 });
  reactToRangerCoreDamage(context, { ...hit, at: 15 });
  assert.equal(core.bloodThirst.charges, 0);
  assert.equal(context.events.length, count);
});

test('Solar Focusing Lens keeps not-before eligibility and live spending', () => {
  const context = contextFor(engineerProfession, 'Holosmith', [ENGINEER.SOLAR_FOCUSING_LENS]);
  const state = context.profession.specialization.state;
  const grant = holosmithResolverEventHandlers['engineer.solar-focusing-lens'];
  grant(context, { at: 1.001, stacks: 2, duration: 1 });
  assert.equal(state.solarFocusingLens.expiresAt, 2.04);
  const hit = { at: 1, actorType: 'player', coefficient: 1 };
  assert.equal(consumeSolarFocusingLens(context, hit), undefined);
  assert.equal(consumeSolarFocusingLens(context, { ...hit, at: 1.1, actorType: 'effect' }), undefined);
  assert.equal(state.solarFocusingLens.charges, 2);
  assert.deepEqual(consumeSolarFocusingLens(context, { ...hit, at: 1.001 }), { solarFocusingLens: true });
  assert.equal(state.solarFocusingLens.charges, 1);
  assert.equal(state.solarFocusingLens.expiresAt, 2.04);
  grant(context, { at: 2.001, stacks: 2, duration: 1 });
  assert.equal(state.solarFocusingLens.charges, 2);
  assert.deepEqual(consumeSolarFocusingLens(context, { ...hit, at: 3.04 }), { solarFocusingLens: true });
  assert.equal(consumeSolarFocusingLens(context, { ...hit, at: 3.040001 }), undefined);
  assert.equal(state.solarFocusingLens.charges, 1);
});

test('Mistburn replaces grants, spends on eligible strikes, and excludes its granting hit', () => {
  // Swipe and Mortar complete at 0.8 s; a second pair completes the replacement at 3.8 s.
  const observed = {};
  const hit = { type: 'damage', actorType: 'player', coefficient: 0 };
  const react = (runtime, event) =>
    antiquaryResolverEventReactions.damage(runtime, { ...hit, at: runtime.time, ...event });
  const charges = (runtime) => runtime.profession.specialization.state.mistburn.charges;
  const result = runThief(
    [
      'Skritt Swipe',
      'Mistburn Mortar',
      { type: 'wait', durationMs: 2200 },
      'Skritt Swipe',
      'Mistburn Mortar',
      { type: 'wait', durationMs: 10100 }
    ],
    { specialization: 'Antiquary' },
    {
      catalog: (live) => withSkill(live, THIEF.SKRITT_SWIPE, { cooldown: 0 }),
      probes: [
        [
          2,
          (runtime) => {
            observed.initial = charges(runtime);
            // The Mortar's own strikes, non-strike packets, and effect actors cannot spend a charge.
            for (const event of [
              { skillId: THIEF.MISTBURN_MORTAR },
              { coefficient: undefined },
              { actorType: 'effect' }
            ])
              react(runtime, event);
            observed.ineligible = charges(runtime);
            react(runtime, {});
            observed.spent = charges(runtime);
          }
        ],
        [3.9, (runtime) => (observed.replaced = charges(runtime))],
        [
          13.8,
          (runtime) => {
            react(runtime, {});
            observed.atExpiry = charges(runtime);
            observed.projected = projectThiefPlanningState({
              profession: runtime.profession,
              time: runtime.time
            }).mistburn;
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(observed.initial > 1);
  assert.equal(observed.ineligible, observed.initial);
  assert.equal(observed.spent, observed.initial - 1, 'zero coefficient is still an authored strike');
  // The spent charge applies its Burning at the strike's own instant.
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.name === 'Mistburn Mortar — Charged Strike' && event.condition === 'Burning' && event.at === 2
    )
  );
  assert.equal(observed.replaced, observed.initial);
  // The grant expires at its exclusive deadline: a strike there spends nothing and the projection is empty.
  assert.equal(observed.atExpiry, observed.initial);
  assert.equal(observed.projected.charges, 0);
});

test('Mistburn projects its grant without aliases or mutations to runtime state', () => {
  const context = contextFor(thiefProfession, 'Antiquary');
  const state = context.profession.specialization.state;
  state.mistburn = { charges: 3, expiresAt: 5 };
  context.state.time = 2;
  const projected = projectThiefPlanningState({ ...context.state });
  assert.equal(projected.mistburn.charges, 3);
  assert.equal(projected.mistburn.expiresAt, 5);
  for (const internal of [state, snapshotProfessionState(context.profession), projected]) {
    assert.equal(Object.hasOwn(internal, 'mistburnCharges'), false);
    assert.equal(Object.hasOwn(internal, 'mistburnExpiresAt'), false);
  }

  // Both supported UI inputs must show the same live count and remaining duration.
  for (const professionState of [projected, context.profession]) {
    const items = thiefProfession.ui.rotationStateSnapshot({
      specialization: 'Antiquary',
      professionState,
      atSeconds: 2
    });
    assert.equal(items.find((item) => item.id === 'antiquary-mistburn-mortar')?.value, '3 charges · 3.0s');
  }

  context.state.time = 5;
  assert.equal(projectThiefPlanningState({ ...context.state }).mistburn.charges, 0);
  assert.equal(state.mistburn.charges, 3, 'projection must not expire the live runtime grant');
  state.mistburn.charges = 0;
  context.state.time = 2;
  assert.equal(projectThiefPlanningState({ ...context.state }).mistburn.charges, 0);
  const core = contextFor(thiefProfession, 'Core');
  const inactive = projectThiefPlanningState({ ...core.state });
  assert.equal(inactive.mistburn.charges, 0);
  assert.equal(inactive.mistburn.expiresAt, 0);
});
