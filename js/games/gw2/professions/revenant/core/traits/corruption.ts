/** Owns Core Corruption trait reactions to legend invocation and scheduled conditions. */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import { emitLegendInvocationProfile } from '#gw2/professions/revenant/core/traits/invocation-effects.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RevenantCastContext, RevenantSchedulerContext } from '#gw2/professions/revenant/types.js';

/** Applies Invoking Torment and its nested Diabolic Inferno packet at invocation time. */
export function applyInvokingTorment(context: RevenantCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.INVOKING_TORMENT)) return;
  const diabolicInferno = hasTrait(context.config, TRAIT.DIABOLIC_INFERNO);
  emitLegendInvocationProfile(
    context,
    REVENANT_CORE_BALANCE_PROFILE_IDS.invokingTorment,
    at,
    TRAIT.INVOKING_TORMENT,
    (effect) => effect.metadata?.trigger !== 'diabolic-inferno' || diabolicInferno
  );
}

/** Converts each observed Chilled stack into the configured Abyssal Chill Torment packet. */
export function applyAbyssalChill(context: RevenantSchedulerContext, event: SimulationEvent): void {
  if (event.condition !== 'Chilled' || !hasTrait(context.config, TRAIT.ABYSSAL_CHILL)) return;
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.abyssalChill);
  const condition = requireEffect(profile, 'condition', 'Torment');
  if (!condition) return;
  const conditionName = String(condition.condition);
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    skillId: TRAIT.ABYSSAL_CHILL,
    skillName: 'Abyssal Chill',
    name: `Abyssal Chill — ${conditionName}`,
    condition: conditionName,
    stacks: Math.max(0, effectNumber(profile, condition, 'stacks')) * Math.max(1, Number(event.stacks ?? 1)),
    duration: effectNumber(profile, condition, 'duration')
  });
}
