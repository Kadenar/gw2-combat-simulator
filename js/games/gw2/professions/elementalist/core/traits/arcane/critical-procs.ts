import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { criticalTraitEligible } from '#gw2/professions/elementalist/core/traits/critical-eligibility.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';

/** Materializes Arcane Precision after its registered critical-hit reaction succeeds. */
function applyArcanePrecision(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const attunement = professionCoreState(context).primaryAttunement;
  const arcanePrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION);
  const condition = requireEffect(arcanePrecisionProfile, 'condition', attunement);

  if (condition) {
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        source: 'Arcane Precision',
        sourceId: TRAIT.ARCANE_PRECISION,
        actorType: 'player',
        skillName: 'Arcane Precision',
        condition: String(condition.condition),
        stacks: Number(condition.stacks),
        duration: Number(condition.duration),
        triggeredBy: resolverSourceSkill(event)
      }
    });

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Arcane Precision', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Materializes Renewing Stamina after its registered critical-hit reaction succeeds. */
function applyRenewingStamina(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const renewingStaminaProfile = requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA);
  const vigor = requireEffect(renewingStaminaProfile, 'boon', 'Vigor');
  if (vigor) {
    context.effects.emit({
      kind: 'packet',
      durationContext: event,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.RENEWING_STAMINA,
        actorType: 'player',
        skillName: requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA).name,
        kind: String(vigor.boon).toLowerCase(),
        stacks: Number(vigor.stacks),
        duration: vigor.duration,
        triggeredBy: resolverSourceSkill(event),
        priority: Number(event.priority || 0)
      }
    });
  }
}

/** Keep arcanePrecision's critical sampling and timer with its effect owner; the dispatcher fixes cross-trait order. */
export const arcanePrecisionCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.arcane-precision',
  chanceOnCriticalHit: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION), 'procChance'),
  when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.ARCANE_PRECISION),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARCANE_PRECISION), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('arcanePrecision') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('arcanePrecision', readyAt);
    }
  },
  randomStream: 'elementalist.arcane-precision',
  handler: applyArcanePrecision
});

/** Keep renewingStamina's critical sampling and timer with its effect owner; the dispatcher fixes cross-trait order. */
export const renewingStaminaCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.renewing-stamina',
  when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.RENEWING_STAMINA),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.RENEWING_STAMINA), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('renewingStamina') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('renewingStamina', readyAt);
    }
  },
  handler: applyRenewingStamina
});
