import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { criticalTraitEligible } from '#gw2/professions/elementalist/core/traits/critical-eligibility.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';

/** Materializes Burning Precision after its registered critical-hit reaction succeeds. */
function applyBurningPrecision(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  const burningPrecisionProfile = requireBalanceProfileFromContext(context, TRAIT.BURNING_PRECISION);
  const burning = requireEffect(burningPrecisionProfile, 'condition', 'Burning Precision');
  if (burning) {
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: {
        type: 'condition',
        at: event.at,
        source: 'Burning Precision',
        sourceId: TRAIT.BURNING_PRECISION,
        actorType: 'player',
        skillName: 'Burning Precision',
        condition: String(burning.condition),
        stacks: Number(burning.stacks),
        duration: Number(burning.duration),
        triggeredBy: resolverSourceSkill(event),
        metadata: { procCount: 1 }
      }
    });

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Burning Precision', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Keep burningPrecision's critical sampling and timer with its effect owner; the dispatcher fixes cross-trait order. */
export const burningPrecisionCritical = criticalProcHandler<
  ElementalistResolverContext,
  Gw2ResolverEvent,
  NativeResolvedDamageDetails
>({
  id: 'elementalist.burning-precision',
  chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.BURNING_PRECISION),
  when: (context, event, details) => criticalTraitEligible(context, event, details, TRAIT.BURNING_PRECISION),
  internalCooldown: {
    duration: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BURNING_PRECISION), 'internalCooldown'),
    readyAt: (context) => context.procs.deadline('burningPrecision') || 0,
    setReadyAt: (context, readyAt) => {
      context.procs.setDeadline('burningPrecision', readyAt);
    }
  },
  randomStream: 'elementalist.burning-precision',
  handler: applyBurningPrecision
});
