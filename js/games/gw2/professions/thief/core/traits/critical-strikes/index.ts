import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { playerHealthFraction, skillForEvent, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { buildResolverBuff } from '#gw2/platform/effects/packet-builders.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

import type { StealthAttackCompletion } from '#gw2/professions/thief/core/mechanics/boundaries.js';
import {
  signetCompleted,
  stealthAttackCompleted,
  thiefStruck,
  type ThiefStrike
} from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

/** Owns Assassin's Fury tuning and behavior at the existing execution boundaries. */
export const assassinsFury = defineTrait({
  id: TRAIT.ASSASSINS_FURY,
  name: "Assassin's Fury",
  balance: {
    internalCooldown: 2,
    effects: [{ type: 'boon', name: 'Might', boon: 'Might', stacks: 3, duration: 8 }]
  },
  triggers: [
    {
      on: 'buff.applied',
      emit: TRAIT.ASSASSINS_FURY,
      cooldown: 'profile',
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === 'fury' &&
        Boolean(event.resolvedAudience?.includesSelf) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.ASSASSINS_FURY), 'boon', 'Might')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'Might',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.ASSASSINS_FURY,
        skillName: "Assassin's Fury",
        name: "Assassin's Fury - might",
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Own the Fury payload and ICD; the critical-boon handler retains the dispatcher's precise reaction boundary. */
export const unrelentingStrikes = defineTrait({
  id: TRAIT.UNRELENTING_STRIKES,
  name: 'Unrelenting Strikes',
  triggers: [
    onTriggerPoint(thiefStruck, {
      run: (runtime: ThiefRuntime, { cause, details }: ThiefStrike) => applyUnrelentingStrikes(runtime, cause, details)
    })
  ],
  balance: {
    internalCooldown: 8,
    effects: [{ type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 4 }]
  }
});

/** Owns this trait's modifier eligibility. */
export const deadlyAim = defineTrait({
  id: TRAIT.DEADLY_AIM,
  name: 'Deadly Aim',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      order: 6,
      id: 'thief.deadly-aim',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEADLY_AIM), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        skillForEvent(context.profession?.catalog, context.event, context.skillId)?.weapon === 'Pistol'
    }
  ]
});

/** Owns Ferocious Strikes tuning and behavior at the existing execution boundaries. */
export const ferociousStrikes = defineTrait({
  id: TRAIT.FEROCIOUS_STRIKES,
  name: 'Ferocious Strikes',
  modifierRules: [
    {
      order: 3,
      id: 'thief.ferocious-strikes',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_STRIKES), 'criticalDamage'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        targetHealthFraction(context) >
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_STRIKES), 'threshold')
    }
  ],
  balance: {
    threshold: 0.5,
    criticalDamage: 1.1
  }
});

/** Owns Hidden Killer tuning and behavior at the existing execution boundaries. */
export const hiddenKiller = defineTrait({
  id: TRAIT.HIDDEN_KILLER,
  name: 'Hidden Killer',
  modifierRules: [
    {
      order: 14,
      id: 'thief.hidden-killer',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HIDDEN_KILLER), 'criticalChance'),
      when: (context) => {
        const state = thiefRuntimeState(context);
        return (
          isGw2PlayerModifierOwnedEvent(context.event) &&
          // The explicit expiry is armed by stealth, never by the initial Revealed sentinel.
          (state.stealthStartedAt || 0) <= context.time &&
          ((state.stealthUntil || 0) > context.time || (state.hiddenKillerUntil || 0) > context.time)
        );
      }
    }
  ],
  balance: {
    criticalChance: 1,
    duration: 4
  }
});

/** Owns Keen Observer tuning and behavior at the existing execution boundaries. */
export const keenObserver = defineTrait({
  id: TRAIT.KEEN_OBSERVER,
  name: 'Keen Observer',
  modifierRules: [
    {
      order: 13,
      id: 'thief.keen-observer',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      // Preserve low-health stat previews; simulation queries always return full player health.
      amount: (context) => {
        const keenObserverProfile = requireBalanceProfileFromContext(context, TRAIT.KEEN_OBSERVER);
        return playerHealthFraction(context) > balanceProfileNumber(keenObserverProfile, 'threshold')
          ? balanceProfileNumber(keenObserverProfile, 'criticalChance')
          : balanceProfileNumber(keenObserverProfile, 'lowHealthCriticalChance');
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  balance: {
    threshold: 0.5,
    lowHealthCriticalChance: 0.1,
    criticalChance: 0.15
  }
});

/** Owns No Quarter tuning and behavior at the existing execution boundaries. */
export const noQuarter = defineTrait({
  id: TRAIT.NO_QUARTER,
  name: 'No Quarter',
  triggers: [
    onTriggerPoint(thiefStruck, {
      run: (runtime: ThiefRuntime, { cause, details }: ThiefStrike) => applyNoQuarter(runtime, cause, details)
    })
  ],
  balance: {
    internalCooldown: 2,
    attributeBonus: 250,
    effects: [{ type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 2 }]
  },
  attributes({ loadout, balanceContext }) {
    const thiefBuild = loadout;
    const noQuarterProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.NO_QUARTER);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(noQuarterProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: Boolean(thiefBuild.assumptions.fury)
        }
      ]
    };
  }
});

/** Owns Practiced Tolerance tuning and behavior at the existing execution boundaries. */
export const practicedTolerance = defineTrait({
  id: TRAIT.PRACTICED_TOLERANCE,
  name: 'Practiced Tolerance',
  balance: { attributeConversion: 0.1 },
  attributes({ balanceContext }) {
    const practicedToleranceProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.PRACTICED_TOLERANCE);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Precision',
          to: 'Ferocity',
          multiplier: balanceProfileNumber(practicedToleranceProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Owns Signets of Power tuning and behavior at the existing execution boundaries. */
export const signetsOfPower = defineTrait({
  // The grant follows a completed signet cast at cast end; an interrupted activation restores no initiative.
  triggers: [
    onTriggerPoint(signetCompleted, {
      run: (runtime) =>
        runtime.resourceController.grant(
          'initiative',
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SIGNETS_OF_POWER), 'resourceGain')
        )
    })
  ],
  id: TRAIT.SIGNETS_OF_POWER,
  name: 'Signets of Power',
  balance: {
    resourceGain: 3
  }
});

/** Owns Sundering Shade tuning and behavior at the existing execution boundaries. */
export const sunderingShade = defineTrait({
  id: TRAIT.SUNDERING_SHADE,
  name: 'Sundering Shade',
  triggers: [onTriggerPoint(stealthAttackCompleted, { run: completeThiefStealthAttack })],
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Vulnerability',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 5
      }
    ]
  }
});

/** Owns Twin Fangs tuning and behavior at the existing execution boundaries. */
export const twinFangs = defineTrait({
  id: TRAIT.TWIN_FANGS,
  name: 'Twin Fangs',
  modifierRules: [
    {
      order: 4,
      id: 'thief.twin-fangs-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      // Preserve low-health stat previews; simulation queries always return full player health.
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.TWIN_FANGS),
          playerHealthFraction(context) >
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TWIN_FANGS), 'threshold')
            ? 'criticalDamage'
            : 'lowHealthCriticalDamage'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: 5,
      id: 'thief.twin-fangs-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TWIN_FANGS), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && Boolean(context.config?.target?.defiant)
    }
  ],
  balance: {
    threshold: 0.5,
    criticalDamage: 1.07,
    lowHealthCriticalDamage: 1.05,
    criticalChance: 0.07
  }
});

/** Natural expiry and forced exit share the selected patch's linger duration. */
export function hiddenKillerLinger(runtime: ThiefRuntime): number {
  return balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.HIDDEN_KILLER), 'duration');
}

/** Sundering Shade's Vulnerability follows the completed stealth attack. */
function completeThiefStealthAttack(runtime: ThiefRuntime, { cast }: StealthAttackCompletion): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_SHADE);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!vulnerability) return;
  emitTraitProfile(runtime, TRAIT.SUNDERING_SHADE, TRAIT.SUNDERING_SHADE, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'condition', name: 'Vulnerability' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.SUNDERING_SHADE,
      activationId: cast.id,
      name: 'Sundering Shade — Vulnerability',
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name
    }
  });
}

/** Removed boons are omitted; surviving tuning is read from the selected profile. */
function criticalBoonDefinition(context: unknown, traitId: SkillId) {
  const selectedProfile = requireBalanceProfileFromContext(context, traitId);
  const effect = requireEffect(selectedProfile, 'boon', 'Fury');
  if (!effect) return null;
  return {
    boon: String(effect.boon),
    duration: effectNumber(selectedProfile, effect, 'duration'),
    stacks: effectNumber(selectedProfile, effect, 'stacks')
  };
}

/** Shared eligibility excludes non-player, missed, cancelled and flat life-steal packets. */
function criticalBoonEligible(context: ThiefResolverContext, event: ThiefResolverEvent, traitId: SkillId): boolean {
  return (
    event.type === 'damage' &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    event.cancelled !== true &&
    !missesTarget(event) &&
    event.canCrit !== false &&
    !Number.isFinite(event.flatDamage) &&
    !Number.isFinite(event.flatStrikeBase) &&
    !Number.isFinite(event.flatStrikePowerCoeff) &&
    criticalBoonDefinition(context, traitId) !== null
  );
}

const unrelentingStrikesCriticalReaction = Object.freeze({
  id: 'thief.unrelenting-strikes',
  actorTypes: ['player'] as const,
  when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: NativeResolvedDamageDetails) =>
    Boolean(details.hitContext?.critEligible) && criticalBoonEligible(context, event, TRAIT.UNRELENTING_STRIKES),
  internalCooldown: {
    duration: (context: ThiefResolverContext) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNRELENTING_STRIKES), 'internalCooldown'),
    readyAt: (context: ThiefResolverContext) => context.procs.deadline(TRAIT.UNRELENTING_STRIKES) || 0,
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      context.procs.setDeadline(TRAIT.UNRELENTING_STRIKES, readyAt);
    }
  },
  handler: (context, event, _details, application) => {
    // One invocation shares authored effects; each queued boon still samples live duration scaling.
    const definition = criticalBoonDefinition(context, TRAIT.UNRELENTING_STRIKES);
    if (!definition) return;
    const { boon, duration, stacks } = definition;
    for (let proc = 0; proc < application.quantity; proc += 1) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverBuff({
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.UNRELENTING_STRIKES,
          actorType: 'effect',
          skillId: TRAIT.UNRELENTING_STRIKES,
          skillName: 'Unrelenting Strikes',
          name: `Unrelenting Strikes - ${boon}`,
          kind: boon.toLowerCase(),
          duration,
          stacks,
          audience: { recipients: 'party' },
          triggeredBy: event.skillName
        }),
        durationContext: event
      });
    }
  }
} satisfies ThiefCriticalHitDefinition);

/** The damage dispatcher invokes this after stealth breaking and before No Quarter, sharing the resolved critical fact. */
const applyUnrelentingStrikes = criticalProcHandler(unrelentingStrikesCriticalReaction);

function extendActiveFury(context: ThiefResolverContext, event: ThiefResolverEvent, duration: number): void {
  // Extend Fury only while its canonical half-open window is active at the hit time.
  if (
    remainingDurationStackSeconds(context.combat.boonApplications('fury'), event.at, {
      includes: (application) => buffMatchesAudience(application, 'all'),
      maximum: durationStackingBoonCapSeconds('fury')
    }) <= 0
  )
    return;
  const extension: ThiefResolverEvent = {
    type: 'boon_extension',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.NO_QUARTER,
    actorType: 'effect',
    skillId: TRAIT.NO_QUARTER,
    skillName: 'No Quarter',
    kind: 'fury',
    duration
  };
  // Extension settles in the hit transaction before subsequent critical reactions inspect Fury.
  context.effects.emit({ kind: 'packet', event: extension, cause: event, settlement: 'reaction' });
  context.effects.emit({
    kind: 'announcement',
    cause: event,
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.NO_QUARTER,
      actorType: 'effect',
      skillId: TRAIT.NO_QUARTER,
      skillName: 'No Quarter'
    },
    announcement: {
      type: 'trait',
      name: 'No Quarter - Fury Extension',
      at: event.at,
      sourceSkill: event.skillName,
      detail: `Fury extended by ${duration}s`
    }
  });
}

const noQuarterCriticalReaction = Object.freeze({
  id: 'thief.no-quarter',
  actorTypes: ['player'] as const,
  when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: NativeResolvedDamageDetails) =>
    Boolean(details.hitContext?.critEligible) &&
    criticalBoonEligible(context, event, TRAIT.NO_QUARTER) &&
    details.hitContext?.critical.furyActive === true,
  internalCooldown: {
    duration: (context: ThiefResolverContext) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NO_QUARTER), 'internalCooldown'),
    readyAt: (context: ThiefResolverContext) => context.procs.deadline(TRAIT.NO_QUARTER) || 0,
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      context.procs.setDeadline(TRAIT.NO_QUARTER, readyAt);
    }
  },
  handler: (context, event, _details, application) => {
    // Reuse authored duration within this batch while extending the live pool for each proc.
    const definition = criticalBoonDefinition(context, TRAIT.NO_QUARTER);
    if (!definition) return;
    const { duration } = definition;
    for (let proc = 0; proc < application.quantity; proc += 1) {
      extendActiveFury(context, event, duration);
    }
  }
} satisfies ThiefCriticalHitDefinition);

/** Runs after Unrelenting Strikes on the same resolved critical fact and random stream. */
const applyNoQuarter = criticalProcHandler(noQuarterCriticalReaction);

type ThiefCriticalHitDefinition = ResolvedCriticalHitOptions<
  ThiefResolverContext,
  ThiefResolverEvent,
  NativeResolvedDamageDetails
>;
