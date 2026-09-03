/** Resolver event classification and reaction registration for Core Elementalist behavior. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext, ElementalistResolverEvent } from '#gw2/professions/elementalist/types.js';
import { PERSISTING_FLAMES_FIELD_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import { isElementalistAttunement, type ElementalistAuraState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  applyArcanePrecision,
  applyBurningPrecision,
  applyElementalistResolverAuraTraits,
  applyRagingStorm,
  applyRenewingStamina,
  applyStrengthOfStone,
  elementalistAuraDuration,
  grantPersistingFlames
} from '#gw2/professions/elementalist/core/traits/index.js';
import {
  elementalistResolverCoreState,
  elementalistSourceSkill
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

export {
  activeElementalistBuffs,
  elementalistSourceSkill,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

/** Mirrors an attunement event into Core and any specialization-owned secondary attunement state. */
export function applyElementalistResolverAttunement(
  context: ElementalistResolverContext,
  event: ElementalistResolverEvent
): void {
  const core = elementalistResolverCoreState(context);
  if (isElementalistAttunement(event.to)) core.primaryAttunement = event.to;
  core.attunementEnteredAt = event.at;

  const specialization = context.profession.specialization.state as SchedulerRecord;
  if (Object.hasOwn(specialization, 'secondaryAttunement')) {
    specialization.secondaryAttunement = isElementalistAttunement(event.secondaryAttunement)
      ? event.secondaryAttunement
      : null;
  }
}

/** Queues a resolver-generated aura after applying Smothering Auras exactly once. */
export function queueElementalistAura(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  aura: string,
  duration: number,
  skillName: string
): void {
  enqueueOrdered(context.queue, {
    type: 'elementalist.aura',
    at: event.at,
    source: skillName,
    sourceId: event.skillId ?? event.sourceId ?? skillName,
    actorType: 'effect',
    skillName,
    aura,
    duration: elementalistAuraDuration(context, duration),
    elementalistResolverGeneratedAura: true
  });
}

// Record each aura once, then dispatch Core aura traits before specialization reactions.
export function applyElementalistResolverAura(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (event.elementalistAuraReactionDispatched === true) return;
  const skillName = elementalistSourceSkill(event);
  const duration = Math.max(0, Number(event.duration || 0));
  const auraState: ElementalistAuraState = {
    type: String(event.aura || ''),
    appliedAt: event.at,
    expiresAt: event.at + duration,
    skillName
  };
  elementalistResolverCoreState(context).activeAuras.push(auraState);
  if (event.elementalistResolverGeneratedAura === true) context.resolved.push(event);
  if (context.combatStartTime != null && event.at < context.combatStartTime) return;

  if (event.elementalistResolverGeneratedAura === true || event.type === 'aura') {
    applyElementalistResolverAuraTraits(context, event);
  }

  if (event.type === 'elementalist.aura') {
    Object.assign(event, { elementalistAuraReactionDispatched: true });
    context.dispatchReaction('aura.applied', event);
  }
}

// Critical reaction definitions retain sampling, expected-progress, ICD, and registration ownership here.
function criticalTraitEligible(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails,
  trait: string
): boolean {
  return (
    hasTrait(context, trait) &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    details.hitContext?.critEligible === true
  );
}

export const elementalistCoreCriticalReactions = Object.freeze([
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.raging-storm',
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Raging Storm'),
    expectedProgress: {
      get: (context) => Number(elementalistResolverCoreState(context).criticalProcProgress.ragingStorm || 0),
      set: (context, progress) => {
        elementalistResolverCoreState(context).criticalProcProgress.ragingStorm = progress;
      }
    },
    internalCooldown: {
      duration: (context) => balanceProfileValueFromContext(context, PROFILE.ragingStorm, 'internalCooldown', 8),
      readyAt: (context) => Number(elementalistResolverCoreState(context).procReadyAt.ragingStorm || 0),
      setReadyAt: (context, readyAt) => {
        elementalistResolverCoreState(context).procReadyAt.ragingStorm = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.RAGING_STORM },
    handler: applyRagingStorm
  }),
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.arcane-precision',
    chanceOnCriticalHit: (context) =>
      balanceProfileValueFromContext(context, PROFILE.arcanePrecision, 'procChance', 0.33),
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Arcane Precision'),
    expectedProgress: {
      get: (context) => Number(elementalistResolverCoreState(context).criticalProcProgress.arcanePrecision || 0),
      set: (context, progress) => {
        elementalistResolverCoreState(context).criticalProcProgress.arcanePrecision = progress;
      }
    },
    internalCooldown: {
      duration: (context) => balanceProfileValueFromContext(context, PROFILE.arcanePrecision, 'internalCooldown', 3),
      readyAt: (context) => Number(elementalistResolverCoreState(context).procReadyAt.arcanePrecision || 0),
      setReadyAt: (context, readyAt) => {
        elementalistResolverCoreState(context).procReadyAt.arcanePrecision = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    randomStream: 'elementalist.arcane-precision',
    attribution: { kind: 'trait', id: TRAIT.ARCANE_PRECISION },
    handler: applyArcanePrecision
  }),
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.renewing-stamina',
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Renewing Stamina'),
    expectedProgress: {
      get: (context) => Number(elementalistResolverCoreState(context).criticalProcProgress.renewingStamina || 0),
      set: (context, progress) => {
        elementalistResolverCoreState(context).criticalProcProgress.renewingStamina = progress;
      }
    },
    internalCooldown: {
      duration: (context) => balanceProfileValueFromContext(context, PROFILE.renewingStamina, 'internalCooldown', 10),
      readyAt: (context) => Number(elementalistResolverCoreState(context).procReadyAt.renewingStamina || 0),
      setReadyAt: (context, readyAt) => {
        elementalistResolverCoreState(context).procReadyAt.renewingStamina = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.RENEWING_STAMINA },
    handler: applyRenewingStamina
  }),
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.burning-precision',
    chanceOnCriticalHit: (context) =>
      balanceProfileValueFromContext(context, PROFILE.burningPrecision, 'procChance', 0.33),
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Burning Precision'),
    expectedProgress: {
      get: (context) => elementalistResolverCoreState(context).burningPrecisionProgress,
      set: (context, progress) => {
        elementalistResolverCoreState(context).burningPrecisionProgress = progress;
      }
    },
    internalCooldown: {
      duration: (context) => balanceProfileValueFromContext(context, PROFILE.burningPrecision, 'internalCooldown', 5),
      readyAt: (context) => Number(elementalistResolverCoreState(context).procReadyAt.burningPrecision || 0),
      setReadyAt: (context, readyAt) => {
        elementalistResolverCoreState(context).procReadyAt.burningPrecision = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    randomStream: 'elementalist.burning-precision',
    attribution: { kind: 'trait', id: TRAIT.BURNING_PRECISION },
    handler: applyBurningPrecision
  })
]);

/** Classifies field ticks before dispatching Persisting Flames damage behavior. */
export function applyElementalistResolvedDamage(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  _details: NativeResolvedDamageDetails = {}
): void {
  if (
    event.damageKind === 'field-tick' &&
    PERSISTING_FLAMES_FIELD_SKILLS.has(Number(event.skillId ?? event.sourceId))
  ) {
    grantPersistingFlames(context, event);
  }
}

/** Classifies conditions and preserves Strength of Stone before Persisting Flames. */
export function applyElementalistResolvedCondition(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (
    ['Immobilize', 'Immobilized'].includes(String(event.condition)) &&
    (context.combatStartTime == null || event.at >= context.combatStartTime)
  ) {
    applyStrengthOfStone(context, event);
  }

  if (event.condition === 'Burning') grantPersistingFlames(context, event);
}

/** Mirrors Signet of Fire's passive-suppression window into resolver state. */
export function applyElementalistResolverSignetFire(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  elementalistResolverCoreState(context).signetOfFireDisabledUntil = Number(event.disabledUntil || event.at);
}
