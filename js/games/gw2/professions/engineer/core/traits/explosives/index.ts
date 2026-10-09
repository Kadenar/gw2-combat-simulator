import { emitExplosiveEntrance } from '#gw2/professions/engineer/core/traits/explosives/explosions.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  ENGINEER_TRAIT_SKILL_MECHANICS,
  triggerLesserGrenadeBarrage
} from '#gw2/professions/engineer/core/skills/trait-skills.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { playerHealthFraction, targetHealthFraction } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { applyAimAssistedRocket } from '#gw2/professions/engineer/core/traits/explosives/explosions.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  procChanceFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { activeBuffStacks, skillForEvent, vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  isExplosion,
  buildEngineerBuff,
  buildEngineerCondition,
  resolverSkill
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { type EngineerResolverContext, type EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
/** Grenadier owns its heal trigger and explosion modifier; the barrage owns its skill balance. */
export const grenadier = defineTrait({
  id: TRAIT.GRENADIER,
  name: 'Grenadier',
  hooks: {
    // Only completed heals with Grenadier selected request the skill-owned barrage and recharge.
    onCastCommit(context, cast) {
      if (!hasTrait(context, TRAIT.GRENADIER) || (cast.skill.type !== 'Heal' && cast.skill.slot !== 'Heal')) return;
      triggerLesserGrenadeBarrage(context, cast.skill, context.time);
    }
  },
  modifierRules: [
    {
      id: 'engineer.grenadier-explosion-damage',
      order: -17,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Live remains neutral; preview tuning increases only player-owned explosion strikes with Grenadier selected.
      factor: 1,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        isExplosion(
          context.event,
          skillForEvent(context.profession?.catalog, context.event, context.event?.sourceId ?? context.skillId)
        )
    }
  ]
});

/** Owns Explosive Entrance tuning and behavior at its established runtime and build boundaries. */
export const explosiveEntrance = defineTrait({
  id: TRAIT.EXPLOSIVE_ENTRANCE,
  name: 'Explosive Entrance',
  balance: {
    // Dodging rearms the attack, independently of the produced skill's short recharge.
    cooldownPolicy: 'playerRecharge',
    cooldown: ENGINEER_TRAIT_SKILL_MECHANICS[ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL]!.cooldown,
    effects: [{ name: 'Explosive Entrance', type: 'strike', coefficient: 1.25, hits: 1 }]
  },
  hooks: {
    eventHandlers: { 'engineer.dodge': resetExplosiveEntrance },
    reactions: { 'damage.resolved': applyExplosiveEntrance }
  }
});

/** Owns Steel-Packed Powder tuning and behavior at its established runtime and build boundaries. */
export const steelPackedPowder = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'damage.resolved': applySteelPackedPowder } },
  id: TRAIT.STEEL_PACKED_POWDER,
  name: 'Steel-Packed Powder',
  balance: {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5 }]
  }
});

/** Owns Short Fuse tuning and behavior at its established runtime and build boundaries. */
export const shortFuse = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'damage.resolved': applyShortFuse } },
  id: TRAIT.SHORT_FUSE,
  name: 'Short Fuse',
  balance: {
    internalCooldown: 3,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  }
});

/** Owns Explosive Temper tuning and behavior at its established runtime and build boundaries. */
export const explosiveTemper = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'damage.resolved': applyExplosiveTemper } },
  id: TRAIT.EXPLOSIVE_TEMPER,
  name: 'Explosive Temper',
  balance: {
    maximumStacks: 10,
    attributePerStack: 20,
    effects: [{ name: 'explosive-temper', type: 'buff', kind: 'explosive-temper', stacks: 1, duration: 10 }]
  }
});

/** Owns Shrapnel tuning and behavior at its established runtime and build boundaries. */
export const shrapnel = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'damage.resolved': applyShrapnel } },
  id: TRAIT.SHRAPNEL,
  name: 'Shrapnel',
  balance: {
    procRate: {
      id: 'engineer.shrapnel',
      traitId: TRAIT.SHRAPNEL,
      field: 'procChance',
      opportunity: 'eligible explosion hit'
    },
    procChance: 0.33,
    effects: [
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6 },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', stacks: 1, duration: 1 }
    ]
  }
});

/** Owns Aim-Assisted Rocket tuning and behavior at its established runtime and build boundaries. */
export const aimAssistedRocket = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: {
    reactions: {
      'damage.resolved'(context, event) {
        // Damage reactions require a strike; Air Blast separately supplies its accepted projectile opportunity.
        if (Number(event.coefficient) > 0) applyAimAssistedRocket(context, event);
      }
    }
  },
  id: TRAIT.AIM_ASSISTED_ROCKET,
  name: 'Aim-Assisted Rocket',
  balance: {
    internalCooldown: 3,
    maximumStacks: 5,
    effects: [
      {
        name: 'Rocket',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        name: 'Orbital Strike',
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        atMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});

/** Owns Grand Entrance tuning and behavior at its established runtime and build boundaries. */
export const grandEntrance = defineTrait({
  // Register this trait's reaction at its causal gameplay boundary.
  hooks: { reactions: { 'damage.resolved': applyGrandEntrance } },
  id: TRAIT.GRAND_ENTRANCE,
  name: 'Grand Entrance',
  balance: {
    criticalChance: 0.1
  },
  modifierRules: [
    {
      order: -12,
      id: 'engineer.grand-entrance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GRAND_ENTRANCE), 'criticalChance'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && activeBuffStacks(context, 'grand-entrance', 1) > 0
    }
  ]
});

/** Owns Blast Shield tuning and behavior at its established runtime and build boundaries. */
export const blastShield = defineTrait({
  id: TRAIT.BLAST_SHIELD,
  name: 'Blast Shield',
  balance: { attributeConversion: 0.1 },
  buildAttributes: traitAttributeEffects(TRAIT.BLAST_SHIELD, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Vitality',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Glass Cannon tuning and behavior at its established runtime and build boundaries. */
export const glassCannon = defineTrait({
  id: TRAIT.GLASS_CANNON,
  name: 'Glass Cannon',
  modifierRules: [
    {
      order: -20,
      id: 'engineer.glass-cannon',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && playerHealthFraction(context) > 0.75
    }
  ]
});

/** Owns Big Boomer tuning and behavior at its established runtime and build boundaries. */
export const bigBoomer = defineTrait({
  id: TRAIT.BIG_BOOMER,
  name: 'Big Boomer',
  modifierRules: [
    {
      order: -19,
      id: 'engineer.big-boomer',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && playerHealthFraction(context) > targetHealthFraction(context)
    }
  ]
});

/** Owns Shaped Charge tuning and behavior at its established runtime and build boundaries. */
export const shapedCharge = defineTrait({
  id: TRAIT.SHAPED_CHARGE,
  name: 'Shaped Charge',
  modifierRules: [
    {
      order: -18,
      // caps at 25 stacks to match the in-game vulnerability stack cap
      id: 'engineer.shaped-charge',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        maximumStacks: 25,
        damagePerStack: 0.005
      },
      factor: (context, _target, parameters) =>
        1 + Math.min(parameters.maximumStacks, vulnerabilityStacks(context)) * parameters.damagePerStack,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Applies Steel-Packed Powder to a hit already classified as an explosion. */
function applySteelPackedPowder(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  if (!explosion || !hasTrait(context, TRAIT.STEEL_PACKED_POWDER)) return;
  const steelPackedPowderProfile = requireBalanceProfileFromContext(context, TRAIT.STEEL_PACKED_POWDER);
  const steelPackedPowderVulnerability = requireEffect(steelPackedPowderProfile, 'condition', 'Vulnerability');
  if (steelPackedPowderVulnerability) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Steel-Packed Powder',
        condition: String(steelPackedPowderVulnerability.condition),
        stacks: Number(steelPackedPowderVulnerability.stacks),
        duration: Number(steelPackedPowderVulnerability.duration),
        sourceId: TRAIT.STEEL_PACKED_POWDER,
        actorType: 'effect'
      }),
      settlement: 'reaction'
    });
  }
}

/** Grants Short Fuse fury from an explosion when its internal cooldown is ready. */
function applyShortFuse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  const state = context.procs;
  if (
    !explosion ||
    !hasTrait(context, TRAIT.SHORT_FUSE) ||
    !isInternalCooldownReady(event.at, state.deadline('shortFuse') || 0)
  ) {
    return;
  }

  const shortFuseProfile = requireBalanceProfileFromContext(context, TRAIT.SHORT_FUSE);
  state.setDeadline('shortFuse', event.at + balanceProfileNumber(shortFuseProfile, 'internalCooldown'));
  const shortFuseFury = requireEffect(shortFuseProfile, 'boon', 'fury');
  if (shortFuseFury) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Short Fuse',
        kind: String(shortFuseFury.boon).toLowerCase(),
        stacks: Number(shortFuseFury.stacks),
        duration: shortFuseFury.duration,
        sourceId: TRAIT.SHORT_FUSE,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.SHORT_FUSE, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Short Fuse', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Adds an Explosive Temper stack for each explosion hit. */
function applyExplosiveTemper(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  if (!explosion || !hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) return;
  const explosiveTemperProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_TEMPER);
  const explosiveTemperBuff = requireEffect(explosiveTemperProfile, 'buff', 'explosive-temper');
  if (explosiveTemperBuff) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Explosive Temper',
        kind: 'explosive-temper',
        stacks: Number(explosiveTemperBuff.stacks),
        duration: explosiveTemperBuff.duration,
        sourceId: TRAIT.EXPLOSIVE_TEMPER,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.EXPLOSIVE_TEMPER, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Explosive Temper', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grants Grand Entrance's resistance and critical-chance window from its trait strike. */
function applyGrandEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Non-strike notifications must not consume this trait's proc opportunity.
  if (!(Number(event.coefficient) > 0)) return;
  if (Number(event.sourceId) !== TRAIT.EXPLOSIVE_ENTRANCE || !hasTrait(context, TRAIT.GRAND_ENTRANCE)) return;
  context.effects.emit({
    kind: 'packet',
    event: buildEngineerBuff(event, {
      name: 'Grand Entrance — resistance',
      kind: 'resistance',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: 'effect'
    }),
    durationContext: event
  });
  context.effects.emit({
    kind: 'packet',
    event: buildEngineerBuff(event, {
      name: 'Grand Entrance',
      kind: 'grand-entrance',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: 'effect'
    }),
    durationContext: event
  });
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.GRAND_ENTRANCE, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: { type: 'trait', name: 'Grand Entrance', at: event.at, sourceSkill: event.skillName, icon: '' }
  });
}

/** Rolls Shrapnel against the simulation seed in both modes for each eligible explosion. */
function applyShrapnel(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  // Generated rocket explosions also roll Shrapnel; effect ownership must not discard their opportunity.
  if (!explosion || !hasTrait(context, TRAIT.SHRAPNEL)) return;
  const chance = procChanceFromContext(context, TRAIT.SHRAPNEL);
  if (!context.random.roll(chance, 'engineer.shrapnel')) return;

  const shrapnelProfile = requireBalanceProfileFromContext(context, TRAIT.SHRAPNEL);
  const shrapnelBleeding = requireEffect(shrapnelProfile, 'condition', 'Bleeding');
  if (shrapnelBleeding) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Shrapnel',
        condition: String(shrapnelBleeding.condition),
        // Count the activation on its primary effect only; the Crippled effect is part of the same proc.
        procCount: 1,
        stacks: Number(shrapnelBleeding.stacks),
        duration: Number(shrapnelBleeding.duration),
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect',
        ownerActorType: 'player'
      }),
      settlement: 'reaction'
    });
  }

  const shrapnelCrippled = requireEffect(shrapnelProfile, 'condition', 'Crippled');
  if (shrapnelCrippled) {
    // Resolve Crippled as a target condition so duration bonuses and condition queries include it.
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Shrapnel',
        condition: String(shrapnelCrippled.condition),
        stacks: Number(shrapnelCrippled.stacks),
        duration: Number(shrapnelCrippled.duration),
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect',
        ownerActorType: 'player'
      }),
      settlement: 'reaction'
    });
  }

  if (shrapnelBleeding || shrapnelCrippled)
    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.SHRAPNEL, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Shrapnel', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
}

/** Owns imperative Core Engineer Explosives trait effects without registering their reactions. */

/** Rearms Explosive Entrance after a resolved Engineer dodge. */
function resetExplosiveEntrance(context: EngineerResolverContext): void {
  professionCoreState(context).explosiveEntranceFired = false;
}

/** Queues Explosive Entrance once for the next eligible player strike. */
function applyExplosiveEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Non-strike notifications must not consume this trait's proc opportunity.
  if (!(Number(event.coefficient) > 0)) return;
  if (
    event.actorType !== 'player' ||
    !hasTrait(context, TRAIT.EXPLOSIVE_ENTRANCE) ||
    professionCoreState(context).explosiveEntranceFired
  ) {
    return;
  }

  const explosiveEntranceProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_ENTRANCE);
  const explosiveEntranceStrike = requireEffect(explosiveEntranceProfile, 'strike', 'Explosive Entrance');
  if (explosiveEntranceStrike && context.procs.claim(TRAIT.EXPLOSIVE_ENTRANCE, TRAIT.EXPLOSIVE_ENTRANCE, event.at)) {
    // A hit during skill recharge leaves the dodge-armed attack available for the next eligible hit.
    professionCoreState(context).explosiveEntranceFired = true;
    emitExplosiveEntrance(context, event);
  }
}
