import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
/** Resolver event classification and reaction registration for Core Elementalist behavior. */
import {
  procChanceFromContext,
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
// Resolver mutations target the owned Core slice of the nested Elementalist runtime.
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';
import { type ElementalistAuraState } from '#gw2/professions/elementalist/core/state.js';
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
import { applyElementalistDerivedCondition } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

export {
  activeElementalistBuffs,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

/** Queues a resolver-generated aura after applying Smothering Auras exactly once. */
export function queueElementalistAura(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  aura: string,
  duration: number,
  skillName: string
): void {
  context.queue.enqueue({
    type: 'elementalist.aura',
    at: event.at,
    source: skillName,
    sourceId: event.skillId ?? event.sourceId,
    actorType: 'effect',
    skillName,
    aura,
    duration: elementalistAuraDuration(context, duration),
    elementalistResolverGeneratedAura: true
  });
}

// Record each aura once, then dispatch Core aura traits before specialization reactions.
export function applyElementalistResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.elementalistAuraReactionDispatched === true) return;
  const skillName = resolverSourceSkill(event);
  const duration = Math.max(0, event.duration || 0);
  const auraState: ElementalistAuraState = {
    type: String(event.aura || ''),
    appliedAt: event.at,
    expiresAt: event.at + duration,
    skillName
  };
  professionCoreState(context).activeAuras.push(auraState);
  if (context.reporting && event.elementalistResolverGeneratedAura === true) context.resolved.push(event);
  if (context.combatStartTime != null && event.at < context.combatStartTime) return;

  {
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
  traitId: number
): boolean {
  return (
    hasTrait(context, traitId) &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    details.hitContext?.critEligible === true
  );
}

export const elementalistCoreCriticalReactions = Object.freeze([
  criticalProcHandler<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.raging-storm',
    when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.RAGING_STORM),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.ragingStorm), 'internalCooldown'),
      readyAt: (context) => context.procs.readyAt.ragingStorm || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.readyAt.ragingStorm = readyAt;
      }
    },
    handler: applyRagingStorm
  }),
  criticalProcHandler<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.arcane-precision',
    chanceOnCriticalHit: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.arcanePrecision), 'procChance'),
    when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.ARCANE_PRECISION),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.arcanePrecision), 'internalCooldown'),
      readyAt: (context) => context.procs.readyAt.arcanePrecision || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.readyAt.arcanePrecision = readyAt;
      }
    },
    randomStream: 'elementalist.arcane-precision',
    handler: applyArcanePrecision
  }),
  criticalProcHandler<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.renewing-stamina',
    when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.RENEWING_STAMINA),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.renewingStamina), 'internalCooldown'),
      readyAt: (context) => context.procs.readyAt.renewingStamina || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.readyAt.renewingStamina = readyAt;
      }
    },
    handler: applyRenewingStamina
  }),
  criticalProcHandler<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.burning-precision',
    chanceOnCriticalHit: (context) => procChanceFromContext(context, PROFILE.burningPrecision),
    when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.BURNING_PRECISION),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.burningPrecision), 'internalCooldown'),
      readyAt: (context) => context.procs.readyAt.burningPrecision || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.readyAt.burningPrecision = readyAt;
      }
    },
    randomStream: 'elementalist.burning-precision',
    handler: applyBurningPrecision
  })
]);

/** Arms Shattering Stone only when its self buff reaches the resolver timeline. */
export function applyElementalistResolverBuff(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.kind !== 'shattering stone' || !event.resolvedAudience?.includesSelf) return;
  const core = professionCoreState(context);
  core.shatteringStone = grantCharges(event.stacks || 0, event.at + (event.duration || 0));
}

/** Applies strike reactions in impact order, regardless of when their packets were scheduled. */
export function applyElementalistResolvedDamage(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  // Fire-field hits grant stacks even from profession skills; only weapon fields receive duration extensions.
  if (
    event.damageKind === 'field-tick' &&
    context.helpers.skillsById
      ?.get(event.skillId ?? event.sourceId)
      ?.comboFields?.some((field) => field.fieldType === 'Fire')
  ) {
    grantPersistingFlames(context, event);
  }

  const core = professionCoreState(context);
  if (
    (event.actorType === 'player' || event.actorType === 'effect') &&
    Number(event.coefficient) > 0 &&
    consumeCharge(core.shatteringStone, event.at)
  ) {
    const shatteringStoneProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringStone);
    const bleeding = requireEffect(shatteringStoneProfile, 'condition', 'Triggered Bleeding');
    if (bleeding) {
      applyElementalistDerivedCondition(context, event, {
        source: 'Shattering Stone',
        sourceId: ID.SHATTERING_STONE,
        condition: String(bleeding.condition),
        stacks: Number(bleeding.stacks),
        duration: Number(bleeding.duration)
      });
    }
  }
}

/** Classifies conditions and preserves Strength of Stone before Persisting Flames. */
export function applyElementalistResolvedCondition(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent
): void {
  if (event.condition === 'Immobilized' && (context.combatStartTime == null || event.at >= context.combatStartTime)) {
    applyStrengthOfStone(context, event);
  }

  if (event.condition === 'Burning') grantPersistingFlames(context, event);
}
