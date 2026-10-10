import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { skillForEvent, targetConditionCount, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';

import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

import type {
  StealAcceptance,
  ThiefConditionApplication,
  ThiefStrike,
  VenomConsumption
} from '#gw2/professions/thief/core/mechanics/boundaries.js';
import {
  stealAccepted,
  thiefConditionApplied,
  thiefStruck,
  venomsConsumed
} from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { potentPoisonStacks } from '#gw2/professions/thief/core/traits/deadly-arts/poison.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

import { stealCompleted, type StealCompletion } from '#gw2/professions/thief/core/mechanics/boundaries.js';

/** Owns Dagger Training tuning and behavior at the existing execution boundaries. */
export const daggerTraining = defineTrait({
  id: TRAIT.DAGGER_TRAINING,
  name: 'Dagger Training',
  balance: { attributeBonus: 80, weaponAttributeBonus: 160 },
  buildAttributes(_common, { build, weaponSet, balanceContext }) {
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const daggerTrainingProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.DAGGER_TRAINING);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            daggerTrainingProfile,
            weapons.includes('Dagger') ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Deadly Ambition tuning and behavior at the existing execution boundaries. */
export const deadlyAmbition = defineTrait({
  id: TRAIT.DEADLY_AMBITION,
  name: 'Deadly Ambition',
  triggers: [onTriggerPoint(thiefStruck, { run: applyDeadlyAmbition })],
  balance: {
    attributeBonus: 180,
    playerStacks: 2,
    effects: [{ type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 1, duration: 3 }]
  },
  buildAttributes(_common, { balanceContext }) {
    const deadlyAmbitionProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.DEADLY_AMBITION);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(deadlyAmbitionProfile, 'attributeBonus'),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Even the Odds tuning and behavior at the existing execution boundaries. */
export const evenTheOdds = defineTrait({
  id: TRAIT.EVEN_THE_ODDS,
  name: 'Even the Odds',
  triggers: [onTriggerPoint(stealAccepted, { run: applyEvenTheOdds })],
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Vulnerability',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      }
    ]
  }
});

/** Owns this trait's modifier eligibility. */
export const executioner = defineTrait({
  id: TRAIT.EXECUTIONER,
  name: 'Executioner',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.2, threshold: 0.5 },
  modifierRules: [
    {
      order: 2,
      id: 'thief.executioner',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EXECUTIONER), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        targetHealthBelow(
          context,
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EXECUTIONER), 'threshold')
        )
    }
  ]
});

/** Owns this trait's modifier eligibility. */
export const exposedWeakness = defineTrait({
  id: TRAIT.EXPOSED_WEAKNESS,
  name: 'Exposed Weakness',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damagePerCondition: 0.02, maximumConditions: CANONICAL_TARGET_CONDITIONS.length },
  modifierRules: [
    {
      order: 1,
      id: 'thief.exposed-weakness',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

      // Count distinct conditions only up to the selected balance cap.
      factor: (context) =>
        1 +
        Math.min(
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EXPOSED_WEAKNESS), 'maximumConditions'),
          targetConditionCount(context)
        ) *
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EXPOSED_WEAKNESS), 'damagePerCondition'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Improvisation tuning and behavior at the existing execution boundaries. */
export const improvisation = defineTrait({
  id: TRAIT.IMPROVISATION,
  name: 'Improvisation',
  triggers: [
    // Antiquary Swipe pilfers shorten recharging utilities before Kleptomaniac.
    onTriggerPoint(stealCompleted, {
      when: (_runtime, { swipe }: StealCompletion) => swipe === true,
      run: reduceUtilityRecharges
    })
  ],
  balance: {
    maximumStacks: 2,
    internalCooldown: 15,
    rechargeMultiplier: 0.75,
    resourceGain: 1,
    lifeForceGain: 1
  }
});

/** Owns Lotus Poison tuning and behavior at the existing execution boundaries. */
export const lotusPoison = defineTrait({
  id: TRAIT.LOTUS_POISON,
  name: 'Lotus Poison',
  triggers: [onTriggerPoint(thiefConditionApplied, { run: applyLotusPoison })],
  balance: {
    internalCooldown: 10,
    effects: [
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 3, duration: 10, audience: { recipients: 'self' } },
      { type: 'condition', name: 'Weakness', condition: 'Weakness', stacks: 1, duration: 4 }
    ]
  }
});

/** Owns Mug tuning and behavior at the existing execution boundaries. */
export const mug = defineTrait({
  id: TRAIT.MUG,
  name: 'Mug',
  triggers: [onTriggerPoint(stealAccepted, { run: applyMug })],
  balance: {
    effects: [{ type: 'strike', name: 'Mug', canCrit: false, coefficient: 1.5, hits: 1 }]
  }
});

/** Owns Panic Strike tuning and behavior at the existing execution boundaries. */
export const panicStrike = defineTrait({
  id: TRAIT.PANIC_STRIKE,
  name: 'Panic Strike',
  triggers: [
    onTriggerPoint(venomsConsumed, { run: applyPanicStrike }),
    onTriggerPoint(thiefConditionApplied, { run: applyPanicStrikePoison })
  ],
  balance: {
    threshold: 3,
    internalCooldown: 20,
    playerStacks: 2,
    effects: [
      {
        type: 'condition',
        name: 'Immobilized',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2.5
      },
      { type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 1, duration: 4 }
    ]
  }
});

/** Owns Potent Poison tuning and behavior at the existing execution boundaries. */
export const potentPoison = defineTrait({
  id: TRAIT.POTENT_POISON,
  name: 'Potent Poison',
  modifierRules: [
    {
      order: 10,
      id: 'thief.potent-poison-damage',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.POTENT_POISON),
          'conditionDamageMultiplier'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === 'Poisoned'
    },
    {
      order: 12,
      id: 'thief.potent-poison-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.POTENT_POISON), 'conditionDurationBonus'),
      // Specific condition-duration bonuses add to Expertise and are skipped when panel stats already include them.
      when: (context) => context.event?.condition === 'Poisoned' && !professionStaticRulesApplied(context.config)
    }
  ],
  balance: {
    conditionDamageMultiplier: 1.33,
    conditionDurationBonus: 0.33
  },
  buildAttributes(_common, { balanceContext }) {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.POTENT_POISON);
    return { traitDurations: { 'Poison Duration': 100 * balanceProfileNumber(profile, 'conditionDurationBonus') } };
  }
});

/** Owns Revealed Training tuning and behavior at the existing execution boundaries. */
export const revealedTraining = defineTrait({
  id: TRAIT.REVEALED_TRAINING,
  name: 'Revealed Training',
  balance: {
    attributeBonus: 80,
    attributePerStack: 120
  },
  buildAttributes(_common, { balanceContext }) {
    const revealedTrainingProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.REVEALED_TRAINING);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(revealedTrainingProfile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Serpent's Touch tuning and behavior at the existing execution boundaries. */
export const serpentsTouch = defineTrait({
  id: TRAIT.SERPENTS_TOUCH,
  name: "Serpent's Touch",
  triggers: [onTriggerPoint(stealAccepted, { run: applySerpentsTouch })],
  balance: {
    playerStacks: 3,
    effects: [{ type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 2, duration: 10 }]
  }
});

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applyRevealedTrainingAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  const state = thiefRuntimeState(context);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (hasTrait(context, TRAIT.REVEALED_TRAINING)) {
    if (!staticRulesApplied) {
      const revealedTrainingProfile = requireBalanceProfileFromContext(context, TRAIT.REVEALED_TRAINING);
      result.power += balanceProfileNumber(revealedTrainingProfile, 'attributeBonus');
    }

    // A recalled Salvo is a later recall hit, not the stealth attack that applied Revealed.
    const revealingAttack =
      skillForEvent(context.profession?.catalog, context.event, context.skillId)?.stealthAttack &&
      context.event?.metadata?.recallSkillId == null;
    if ((state.revealedUntil || 0) > context.time && !revealingAttack) {
      const revealedTrainingProfile = requireBalanceProfileFromContext(context, TRAIT.REVEALED_TRAINING);
      result.power += balanceProfileNumber(revealedTrainingProfile, 'attributePerStack');
    }
  }
}

function applyEvenTheOdds(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EVEN_THE_ODDS);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  emitTraitProfile(runtime, TRAIT.EVEN_THE_ODDS, TRAIT.EVEN_THE_ODDS, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'condition', name: 'Vulnerability' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.EVEN_THE_ODDS,
      activationId: cast.id,
      name: 'Even the Odds — Vulnerability',
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name
    }
  });
}

/** Improvisation shortens every selected, still-recharging utility once per internal cooldown. */
function reduceUtilityRecharges(runtime: ThiefRuntime): void {
  // An eligible pilfer claims the interval even when no selected utility is recharging.
  if (!runtime.procs.claim(TRAIT.IMPROVISATION, 'thief.antiquary.improvisation', runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.IMPROVISATION);
  const multiplier = balanceProfileNumber(profile, 'rechargeMultiplier');
  for (const id of selectedSkillIdSet(runtime.config.selectedSkillIds)) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill?.type === 'Utility')
      runtime.cooldownController.reduceSkillRecharge(skill, gw2BaseRecharge(skill) * (1 - multiplier), runtime.time);
  }
}

/** Mug is an uncritical strike owned by the steal skill. */
function applyMug(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  // The steal supplies identity; the authored noncritical strike supplies all damage fields.
  emitTraitProfile(runtime, TRAIT.MUG, TRAIT.MUG, undefined, {
    at: runtime.time,
    effect: { type: 'strike', name: 'Mug' },
    activationId: cast.id,
    attribution: { actorType: 'player', skillId: cast.skill.id, skillName: cast.skill.name, name: 'Mug' }
  });
}

/** Serpent's Touch Poison is attributed to its trait while retaining the triggering steal. */
function applySerpentsTouch(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SERPENTS_TOUCH);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  if (!poison) return;
  emitTraitProfile(runtime, TRAIT.SERPENTS_TOUCH, TRAIT.SERPENTS_TOUCH, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'condition', name: 'Poisoned' },
    attribution: {
      source: 'Trait',
      skillId: TRAIT.SERPENTS_TOUCH,
      skillName: "Serpent's Touch",
      triggeredBy: cast.skill.name,
      activationId: cast.id,
      name: "Serpent's Touch — Poison",
      actorType: 'player',
      sourceId: TRAIT.SERPENTS_TOUCH
    },
    transform: (packet) => ({ ...packet, stacks: potentPoisonStacks(runtime, profile, poison) })
  });
}

/**
 * The first landed strike of each dual attack applies poison, even when its cast is interrupted later. Returned
 * projectile damage keeps its original skill label while the dual-wield recall owns this trait proc.
 */
function applyDeadlyAmbition(context: ThiefResolverContext, { cause }: ThiefStrike): void {
  const recallId = cause.metadata?.recallSkillId;
  const event: ThiefResolverEvent =
    recallId == null ? cause : { ...cause, skillId: Number(recallId), sourceId: Number(recallId) };
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = skillForEvent(context.helpers, event);
  if (!skill || event.sourceId !== skill.id) return;
  const isDualWieldAttack =
    skill.categories?.includes('DualWield') ||
    Boolean(skill.requiredMainHand && typeof skill.requiredOffHand === 'string');
  if (!isDualWieldAttack) return;
  const state = professionCoreState(context);

  const deadlyAmbitionProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_AMBITION);
  const poison = requireEffect(deadlyAmbitionProfile, 'condition', 'Poisoned');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!poison) return;
  // Preserve the local identity rule for packets without an activation ID.
  const activation = event.activationId || `${skill.id}:${event.at}`;
  if (!claimActivation(state.activationClaims, 'thief.deadly-ambition', activation)) return;
  emitTraitProfile(context, TRAIT.DEADLY_AMBITION, TRAIT.DEADLY_AMBITION, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Poisoned' },
    settlement: 'reaction',
    attribution: {
      source: 'Trait',
      actorType: 'player',
      skillId: TRAIT.DEADLY_AMBITION,
      skillName: 'Deadly Ambition',
      activationId: event.activationId,
      triggeredBy: event.skillName,
      sourceId: TRAIT.DEADLY_AMBITION,
      name: 'Deadly Ambition — Poison'
    },
    transform: (packet) => ({ ...packet, stacks: potentPoisonStacks(context.config, deadlyAmbitionProfile, poison) })
  });
}

/** Player-applied poison grants self Might and target Weakness once per shared ten-second cooldown. */
function applyLotusPoison(context: ThiefResolverContext, { cause: event }: ThiefConditionApplication): void {
  if (event.condition !== 'Poisoned' || event.actorType !== 'player' || (event.metadata?.triggeredByAlly || 0) > 0)
    return;

  const lotusPoisonProfile = requireBalanceProfileFromContext(context, TRAIT.LOTUS_POISON);
  if (
    !context.procs.claimCooldown(
      TRAIT.LOTUS_POISON,
      event.at,
      balanceProfileNumber(lotusPoisonProfile, 'internalCooldown')
    )
  )
    return;
  const might = requireEffect(lotusPoisonProfile, 'boon', 'Might');
  if (might) {
    const boon = String(might.boon);
    emitTraitProfile(context, TRAIT.LOTUS_POISON, TRAIT.LOTUS_POISON, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'boon', name: 'Might' },
      durationContext: event,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.LOTUS_POISON,
        actorType: 'effect',
        skillId: TRAIT.LOTUS_POISON,
        skillName: 'Lotus Poison',
        name: `Lotus Poison - ${boon}`,
        audience: { recipients: 'self' },
        triggeredBy: event.skillName
      }
    });
  }

  const weakness = requireEffect(lotusPoisonProfile, 'condition', 'Weakness');
  if (weakness)
    emitTraitProfile(context, TRAIT.LOTUS_POISON, TRAIT.LOTUS_POISON, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Weakness' },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.LOTUS_POISON,
        actorType: 'player',
        skillId: TRAIT.LOTUS_POISON,
        skillName: 'Lotus Poison',
        name: 'Lotus Poison - Weakness',
        activationId: event.activationId,
        triggeredBy: event.skillName
      }
    });
}

function applyPanicStrike(context: ThiefResolverContext, { cause: event }: VenomConsumption): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;

  const panicStrikeProfile = requireBalanceProfileFromContext(context, TRAIT.PANIC_STRIKE);
  if (poisonTargetConditionCount(context, event.at) < balanceProfileNumber(panicStrikeProfile, 'threshold')) return;
  const immobilized = requireEffect(panicStrikeProfile, 'condition', 'Immobilized');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!immobilized) return;
  // Claim this owner's ICD before effects or resource snapshots can re-enter the trait.
  if (
    !context.procs.claimCooldown(
      TRAIT.PANIC_STRIKE,
      event.at,
      balanceProfileNumber(panicStrikeProfile, 'internalCooldown')
    )
  )
    return;
  emitTraitProfile(context, TRAIT.PANIC_STRIKE, TRAIT.PANIC_STRIKE, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Immobilized' },
    settlement: 'reaction',
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: 'player',
      skillId: TRAIT.PANIC_STRIKE,
      skillName: 'Panic Strike',
      name: 'Panic Strike - Immobilized',
      activationId: `panic-strike:${event.at}`,
      triggeredBy: event.skillName
    }
  });
}

function applyPanicStrikePoison(
  context: ThiefResolverContext,
  { cause: application }: ThiefConditionApplication
): void {
  if (application.condition !== 'Immobilized' || application.actorType !== 'player') return;

  const panicStrikeProfile = requireBalanceProfileFromContext(context, TRAIT.PANIC_STRIKE);
  const poison = requireEffect(panicStrikeProfile, 'condition', 'Poisoned');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!poison) return;
  emitTraitProfile(context, TRAIT.PANIC_STRIKE, TRAIT.PANIC_STRIKE, undefined, {
    at: application.at,
    fullEnd: application.at,
    effect: { type: 'condition', name: 'Poisoned' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: 'player',
      skillId: TRAIT.PANIC_STRIKE,
      skillName: 'Panic Strike',
      name: 'Panic Strike - Poison',
      activationId: application.activationId || `panic-strike:${application.at}`,
      triggeredBy: application.skillName
    },
    transform: (packet) => ({ ...packet, stacks: potentPoisonStacks(context.config, panicStrikeProfile, poison) })
  });
}

function poisonTargetConditionCount(context: ThiefResolverContext, at: number): number {
  return CANONICAL_TARGET_CONDITIONS.filter((condition) => context.combat.targetHasCondition(condition, at)).length;
}
