/** Owns Core Corruption trait reactions to legend invocation and scheduled conditions. */
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/content/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/core/skills/index.js';
import { emitLegendInvocationProfile } from '#gw2/content/professions/revenant/core/traits/invocation-effects.js';
import {
  requireRevenantBalanceProfile as balanceProfile,
  requireRevenantEffect as profileEffect
} from '#gw2/content/professions/revenant/core/traits/profile-access.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent
} from '#gw2/content/professions/revenant/types.js';

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
export function applyAbyssalChill(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.condition !== 'Chilled' || !hasTrait(context.config, TRAIT.ABYSSAL_CHILL)) return;
  const condition = profileEffect(balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.abyssalChill), 'condition');
  const conditionName = String(condition.condition || 'Torment');
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.ABYSSAL_CHILL,
    actorType: 'player',
    skillId: TRAIT.ABYSSAL_CHILL,
    skillName: 'Abyssal Chill',
    name: `Abyssal Chill — ${conditionName}`,
    condition: conditionName,
    stacks: Math.max(0, Number(condition.stacks || 0)) * Math.max(1, Number(event.stacks || 1)),
    duration: Number(condition.duration || 0)
  });
}
