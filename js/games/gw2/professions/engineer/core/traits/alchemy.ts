import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/** Owns HGH's elixir cast effects and scheduled-event duration extension. */
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';

export function isElixirSkill(skill: EngineerSkill | undefined): boolean {
  return Boolean(skill?.categories?.some((category) => String(category).toLowerCase() === 'elixir'));
}

/** Schedules Acid Bomb's extended final pulse while HGH is selected. */
export function applyHghAcidBomb(context: EngineerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  if (!hasTrait(context.config, TRAIT.HGH) || skill.id !== ID.ACID_BOMB) return;

  const hghProfile = requireBalanceProfileFromContext(context, TRAIT.HGH);
  const strike = requireEffect(hghProfile, 'strike', 'HGH');
  if (strike) {
    emitEngineerEvent(
      context,
      'damage',
      {
        at: cast.fullEnd + 6,
        activationId: cast.id,
        coefficient: Number(strike.coefficient),
        hits: Number(strike.hits),
        name: 'Acid Bomb',
        actorType: 'player'
      },
      skill
    );
  }
}

/** Extends scheduled elixir fields, boons, and conditions while HGH is selected. */
export function prepareEngineerHghEvent(context: EngineerRuntime, event: SimulationEventBase): SimulationEventBase {
  if (!hasTrait(context.config, TRAIT.HGH) || event.sourceId === TRAIT.HGH) return event;
  const skill = context.helpers.skillsById.get(event.skillId ?? event.sourceId) as EngineerSkill | undefined;
  if (!isElixirSkill(skill)) return event;
  const hghProfile = requireBalanceProfileFromContext(context, TRAIT.HGH);
  const durationMultiplier = balanceProfileNumber(hghProfile, 'durationMultiplier');

  if (event.type === 'combo_field') {
    const duration = Number(event.expiresAt) - event.at;
    if (duration > 0) return { ...event, expiresAt: event.at + duration * durationMultiplier };
  } else if ((event.type === 'buff' || event.type === 'condition') && Number(event.duration) > 0) {
    return { ...event, duration: Number(event.duration) * durationMultiplier };
  }

  return event;
}
