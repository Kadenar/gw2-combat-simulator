import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { applyElementalistResolvedDamage } from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import { applyShatteringStoneBuff } from '#gw2/professions/elementalist/core/skills/weapons/pistol.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ENGINEER_TRAIT_IDS as ENGINEER } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { consumeSolarFocusingLens } from '#gw2/professions/engineer/specializations/holosmith/traits/behavior.js';
import { solarFocusingLens } from '#gw2/professions/engineer/specializations/holosmith/traits/index.js';
import { necromancerEffectStates } from '#gw2/professions/necromancer/core/effect-state.js';
import {
  applyOverflowingThirstDamage,
  reactToTasteForBloodAlliedHit,
  reactToTasteForBloodGrant
} from '#gw2/professions/necromancer/core/traits/blood-magic/life-steal.js';
import { NECROMANCER_TRAIT_IDS as NECROMANCER } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { rangerCoreHooks } from '#gw2/professions/ranger/core/hooks.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as RANGER_PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import {
  handleRangerSharpeningStone,
  triggerSharpeningStone
} from '#gw2/professions/ranger/core/skills/slot-skills.js';
import {
  handleRangerPoisonousStrikes,
  triggerPoisonousStrikes
} from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { handleRangerBloodThirst } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { reactToSoulbeastDamage } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { antiquaryResolverEventReactions } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifact-effects.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Real state owners and catalogs isolate grant contracts without relying on saved rotation packets.
function contextFor(profession, specialization, selectedTraitIds = []) {
  const config = { specialization, selectedTraitIds };
  const runtime = profession.resolveProfession(config);
  const state = runtime.createState(config);
  // Capture the real shared materialization boundary while keeping grant state transitions isolated.
  const { effects, events } = captureEffectEmissions();

  const context = {
    traits: new Set(selectedTraitIds),
    config,
    profession: state,
    catalog: runtime.catalog,
    helpers: runtime.catalog,
    state: { time: 0, profession: state, cooldowns: new Map() },
    events,
    effects,
    boons: new Map(),
    buffs: new Map(),
    cooldownController: { readyAt: () => undefined, reduceSkillRecharge() {} },
    start: 0,
    effectiveEnd: 1
  };
  context.combat = createMechanicCombatServices(context);
  return context;
}

test('Taste for Blood spends insertion-ordered batches independently with application-time and expiry guards', () => {
  const context = contextFor(necromancerProfession, 'Core', [NECROMANCER.OVERFLOWING_THIRST]);
  const audience = { includesSelf: true, alliedPlayerCount: 1, companionIds: ['minion:test'] };
  reactToTasteForBloodGrant(context, { at: 1, stacks: 2, duration: 10, resolvedAudience: audience });
  reactToTasteForBloodGrant(context, { at: 2, stacks: 1, duration: 3, resolvedAudience: audience });
  const pools = context.profession.core.tasteForBloodGrants;
  const hit = (at, actorType = 'player', summonOwner) =>
    applyOverflowingThirstDamage(context, { at, actorType, summonOwner, skillName: 'Test strike' });
  hit(0);
  assert.deepEqual(
    pools.self.map((grant) => grant.charges),
    [2, 1]
  );
  hit(2);
  assert.deepEqual(
    pools.self.map((grant) => [grant.charges, grant.expiresAt]),
    [
      [1, 11],
      [1, 5]
    ]
  );
  assert.deepEqual(
    pools['ally:1'].map((grant) => grant.charges),
    [2, 1]
  );
  assert.deepEqual(
    pools['companion:minion:test'].map((grant) => grant.charges),
    [2, 1]
  );
  reactToTasteForBloodAlliedHit(context, { at: 2, allyIndex: 1, skillName: 'Ally strike' });
  hit(2, 'summon', 'minion:test');
  assert.deepEqual(
    pools['ally:1'].map((grant) => grant.charges),
    [1, 1]
  );
  assert.deepEqual(
    pools['companion:minion:test'].map((grant) => grant.charges),
    [1, 1]
  );
  // A detached report reflects the canonical remaining counts without consuming them.
  const before = structuredClone(pools);
  const effects = necromancerEffectStates(context);
  assert.deepEqual(effects.find((effect) => effect.recipient === 'self').windows, [
    { stacks: 1, expiresAt: 11 },
    { stacks: 1, expiresAt: 5 }
  ]);
  assert.deepEqual(pools, before);
  hit(3);
  assert.deepEqual(
    pools.self.map((grant) => grant.expiresAt),
    [5]
  );
  const count = context.events.length;
  hit(5);
  assert.equal(context.events.length, count);
  // Appending prunes the closed batch without refreshing other recipients' grants.
  reactToTasteForBloodGrant(context, { at: 5, stacks: 1, duration: 2, resolvedAudience: { includesSelf: true } });
  assert.deepEqual(
    pools.self.map((grant) => grant.expiresAt),
    [7]
  );
  assert.deepEqual(
    pools['ally:1'].map((grant) => grant.expiresAt),
    [11, 5]
  );
  hit(5);
  assert.deepEqual(pools.self, []);
});

test('Taste for Blood preserves charges when its authored strike is removed', () => {
  const context = contextFor(necromancerProfession, 'Core', [NECROMANCER.OVERFLOWING_THIRST]);
  context.catalog = applyBalanceProfilePatch(context.catalog, {
    balanceProfiles: { [NECROMANCER.OVERFLOWING_THIRST]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } }
  });
  reactToTasteForBloodGrant(context, { at: 1, stacks: 2, duration: 5, resolvedAudience: { includesSelf: true } });
  applyOverflowingThirstDamage(context, { at: 2, actorType: 'player' });
  assert.equal(context.profession.core.tasteForBloodGrants.self[0].charges, 2);
  assert.deepEqual(context.events, []);
});

test('Sharpening Stone batches spend earliest expiry and prune without spending on excluded or removed hits', () => {
  const context = contextFor(rangerProfession, 'Core');
  const core = context.profession.core;
  handleRangerSharpeningStone(context, { at: 1, charges: 2.9, duration: 10 });
  handleRangerSharpeningStone(context, { at: 2, charges: 2, duration: 3 });
  assert.deepEqual(
    core.sharpeningStoneGrants.map((grant) => [grant.charges, grant.expiresAt]),
    [
      [2, 5],
      [2, 11]
    ]
  );
  const hit = { at: 2, actorType: 'player', coefficient: 1 };
  triggerSharpeningStone(context, hit);
  assert.deepEqual(
    core.sharpeningStoneGrants.map((grant) => grant.charges),
    [1, 2]
  );
  triggerSharpeningStone(context, { ...hit, at: 5, actorType: 'effect' });
  assert.deepEqual(
    core.sharpeningStoneGrants.map((grant) => [grant.charges, grant.expiresAt]),
    [[2, 11]]
  );
  context.catalog = applyBalanceProfilePatch(context.catalog, {
    balanceProfiles: { [RANGER_PROFILE.sharpeningStone]: { removeEffects: [{ type: 'condition', name: 'Bleeding' }] } }
  });
  triggerSharpeningStone(context, { ...hit, at: 6 });
  assert.equal(core.sharpeningStoneGrants[0].charges, 2);
  triggerSharpeningStone(context, { ...hit, at: 11 });
  assert.deepEqual(core.sharpeningStoneGrants, []);
  assert.equal(context.events.length, 1);
});

test('Shattering Stone replaces self grants and spends player or effect hits before exclusive expiry', () => {
  const context = contextFor(elementalistProfession, 'Core');
  const core = context.profession.core;
  const grant = { kind: 'shattering stone', at: 1, stacks: 2, duration: 2, resolvedAudience: { includesSelf: true } };
  applyShatteringStoneBuff(context, { ...grant, resolvedAudience: { includesSelf: false } });
  assert.equal(core.shatteringStone.charges, 0);
  applyShatteringStoneBuff(context, grant);
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
  applyShatteringStoneBuff(context, { ...grant, at: 2 });
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

test('Blood Thirst grants merged players twelve seconds, replaces remaining charges, and respects strike eligibility', () => {
  // The intentional player duration applies in Beastmode, where player strikes consume the pet's charges.
  const context = contextFor(rangerProfession, 'Soulbeast');
  context.profession.specialization.state.beastmodeActive = true;
  const core = context.profession.core;
  const skill = context.catalog.skillsById.get(RANGER.CRIPPLING_SHOT);
  const grant = (at) => {
    context.time = at;
    // Dispatch the skill's declared commitment reward through the same path as the runtime.
    applySkillSideEffects(
      context,
      { skill, start: at, fullEnd: at, effectiveEnd: at },
      'castCommit',
      rangerCoreHooks.sideEffectHandlers
    );
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
    { source: 'ranger-pet', actorType: 'summon' },
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
  const grant = solarFocusingLens.hooks.eventHandlers['engineer.solar-focusing-lens'];
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
            observed.projected = projectObservedState(thiefProfession, {
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
  const projected = projectObservedState(thiefProfession, { ...context.state });
  assert.equal(projected.mistburn.charges, 3);
  assert.equal(projected.mistburn.expiresAt, 5);
  for (const internal of [state, snapshotProfessionState(context.profession), projected]) {
    assert.equal(Object.hasOwn(internal, 'mistburnCharges'), false);
    assert.equal(Object.hasOwn(internal, 'mistburnExpiresAt'), false);
  }

  // Detached snapshots and planning projections show the same count and remaining duration.
  for (const professionState of [projected, snapshotProfessionState(context.profession)]) {
    const items = thiefProfession.ui.rotationStateSnapshot({
      specialization: 'Antiquary',
      professionState,
      atSeconds: 2
    });
    assert.equal(items.find((item) => item.id === 'antiquary-mistburn-mortar')?.value, '3 charges · 3.0s');
  }

  context.state.time = 5;
  assert.equal(projectObservedState(thiefProfession, { ...context.state }).mistburn.charges, 0);
  assert.equal(state.mistburn.charges, 3, 'projection must not expire the live runtime grant');
  state.mistburn.charges = 0;
  context.state.time = 2;
  assert.equal(projectObservedState(thiefProfession, { ...context.state }).mistburn.charges, 0);
  const core = contextFor(thiefProfession, 'Core');
  const inactive = projectObservedState(thiefProfession, { ...core.state });
  assert.equal(Object.hasOwn(inactive, 'mistburn'), false);
});
