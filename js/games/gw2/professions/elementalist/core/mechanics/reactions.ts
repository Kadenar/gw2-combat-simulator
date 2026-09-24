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
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistResolverContext,
  ElementalistResolverEvent,
  ElementalistState
} from '#gw2/professions/elementalist/types.js';
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
import { applyElementalistDerivedCondition } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

export {
  activeElementalistBuffs,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

/** Mirrors an attunement event into Core and any specialization-owned secondary attunement state. */
export function applyElementalistResolverAttunement(
  context: ElementalistResolverContext,
  event: ElementalistResolverEvent
): void {
  const core = professionCoreState(context);
  if (isElementalistAttunement(event.to)) core.primaryAttunement = event.to;
  core.attunementEnteredAt = event.at;

  // Object.hasOwn checks this optional owned field, but does not narrow the specialization union.
  const specialization = context.profession.specialization.state as Partial<
    Pick<ElementalistState, 'secondaryAttunement'>
  >;
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
  context.queue.enqueue({
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
export function applyElementalistResolverAura(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.elementalistAuraReactionDispatched === true) return;
  const skillName = resolverSourceSkill(event);
  const duration = Math.max(0, Number(event.duration || 0));
  const auraState: ElementalistAuraState = {
    type: String(event.aura || ''),
    appliedAt: event.at,
    expiresAt: event.at + duration,
    skillName
  };
  professionCoreState(context).activeAuras.push(auraState);
  if (context.reporting && event.elementalistResolverGeneratedAura === true) context.resolved.push(event);
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
  onResolvedCriticalHit<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.raging-storm',
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Raging Storm'),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.ragingStorm), 'internalCooldown'),
      readyAt: (context) => Number(professionCoreState(context).procReadyAt.ragingStorm || 0),
      setReadyAt: (context, readyAt) => {
        professionCoreState(context).procReadyAt.ragingStorm = readyAt;
      }
    },
    attribution: { kind: 'trait', id: TRAIT.RAGING_STORM },
    handler: applyRagingStorm
  }),
  onResolvedCriticalHit<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.arcane-precision',
    chanceOnCriticalHit: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.arcanePrecision), 'procChance'),
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Arcane Precision'),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.arcanePrecision), 'internalCooldown'),
      readyAt: (context) => Number(professionCoreState(context).procReadyAt.arcanePrecision || 0),
      setReadyAt: (context, readyAt) => {
        professionCoreState(context).procReadyAt.arcanePrecision = readyAt;
      }
    },
    randomStream: 'elementalist.arcane-precision',
    attribution: { kind: 'trait', id: TRAIT.ARCANE_PRECISION },
    handler: applyArcanePrecision
  }),
  onResolvedCriticalHit<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.renewing-stamina',
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Renewing Stamina'),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.renewingStamina), 'internalCooldown'),
      readyAt: (context) => Number(professionCoreState(context).procReadyAt.renewingStamina || 0),
      setReadyAt: (context, readyAt) => {
        professionCoreState(context).procReadyAt.renewingStamina = readyAt;
      }
    },
    attribution: { kind: 'trait', id: TRAIT.RENEWING_STAMINA },
    handler: applyRenewingStamina
  }),
  onResolvedCriticalHit<ElementalistResolverContext, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.burning-precision',
    chanceOnCriticalHit: (context) => procChanceFromContext(context, PROFILE.burningPrecision),
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Burning Precision'),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.burningPrecision), 'internalCooldown'),
      readyAt: (context) => Number(professionCoreState(context).procReadyAt.burningPrecision || 0),
      setReadyAt: (context, readyAt) => {
        professionCoreState(context).procReadyAt.burningPrecision = readyAt;
      }
    },
    randomStream: 'elementalist.burning-precision',
    attribution: { kind: 'trait', id: TRAIT.BURNING_PRECISION },
    handler: applyBurningPrecision
  })
]);

/** Arms Shattering Stone only when its self buff reaches the resolver timeline. */
export function applyElementalistResolverBuff(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.kind !== 'shattering stone' || !event.resolvedAudience?.includesSelf) return;
  const core = professionCoreState(context);
  core.shatteringStone = grantCharges(Number(event.stacks || 0), event.at + Number(event.duration || 0));
}

/** Applies strike reactions in impact order, regardless of when their packets were scheduled. */
export function applyElementalistResolvedDamage(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent,
  _details: NativeResolvedDamageDetails = {}
): void {
  // Fire-field hits grant stacks even from profession skills; only weapon fields receive duration extensions.
  if (
    event.damageKind === 'field-tick' &&
    context.helpers.skillsById
      ?.get(event.skillId ?? event.sourceId ?? '')
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

/** Mirrors Signet of Fire's passive-suppression window into resolver state. */
export function applyElementalistResolverSignetFire(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent
): void {
  professionCoreState(context).signetOfFireDisabledUntil = Number(event.disabledUntil || event.at);
}
