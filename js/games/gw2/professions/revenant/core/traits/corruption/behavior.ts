import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isDamagingCondition } from '#gw2/platform/combat/state/targets.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Runs the trait at its original ordered mechanic boundary. */
export function reactAbyssalChill(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.condition === 'Chilled' && hasTrait(runtime, TRAIT.ABYSSAL_CHILL)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ABYSSAL_CHILL);
    const condition = requireEffect(profile, 'condition', 'Torment');
    if (condition) {
      const name = String(condition.condition);
      runtime.effects.emit({
        kind: 'packet',
        cause: event,
        event: buildResolverCondition({
          at: runtime.time,
          source: 'revenant',
          sourceId: TRAIT.ABYSSAL_CHILL,
          actorType: 'player',
          skillId: TRAIT.ABYSSAL_CHILL,
          skillName: 'Abyssal Chill',
          name: `Abyssal Chill — ${name}`,
          condition: name,
          stacks: Math.max(0, effectNumber(profile, condition, 'stacks')) * Math.max(1, event.stacks ?? 1),
          duration: effectNumber(profile, condition, 'duration')
        })
      });
    }
  }
}

/** Keeps the additional condition payload tied to the invocation's selected trait. */
function diabolicInfernoSelected(runtime: RevenantRuntime): boolean {
  return hasTrait(runtime, TRAIT.DIABOLIC_INFERNO);
}

/** Adds the trait duration only when static build rules have not supplied it. */
export function pactOfPainDuration(context: Gw2ModifierContext, duration: number): number {
  let modified = duration;
  if (hasTrait(context, TRAIT.PACT_OF_PAIN) && !professionStaticRulesApplied(context.config)) {
    const pactOfPainProfile = requireBalanceProfileFromContext(context, TRAIT.PACT_OF_PAIN);
    modified += balanceProfileNumber(pactOfPainProfile, 'conditionDurationBonus');
  }

  return modified;
}

/** Adds the trait duration only when static build rules have not supplied it. */
export function yearningEmpowermentDuration(context: Gw2ModifierContext, duration: number): number {
  let modified = duration;
  if (
    isDamagingCondition(context.condition) &&
    hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
    !professionStaticRulesApplied(context.config)
  ) {
    const yearningEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.YEARNING_EMPOWERMENT);
    modified += balanceProfileNumber(yearningEmpowermentProfile, 'conditionDurationBonus');
  }

  return modified;
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeTorment(runtime: RevenantRuntime): void {
  if (hasTrait(runtime, TRAIT.INVOKING_TORMENT)) {
    const diabolicInferno = diabolicInfernoSelected(runtime);
    {
      const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.INVOKING_TORMENT);
      runtime.effects.emit({
        kind: 'profile',
        profile: invocationProfile,
        effects: invocationProfile.effects?.filter(
          (effect) => effect.metadata?.trigger !== 'diabolic-inferno' || diabolicInferno
        ),
        attribution: (effect) => ({
          activationId: `legend-invocation:${TRAIT.INVOKING_TORMENT}:${runtime.time}`,
          source: 'Trait',
          sourceId: TRAIT.INVOKING_TORMENT,
          actorType: effect.actorType || 'player',
          skillId: invocationProfile.id,
          skillName: invocationProfile.name
        }),
        skillWeaponFallback: 'Unequipped'
      });
    }
  }
}
