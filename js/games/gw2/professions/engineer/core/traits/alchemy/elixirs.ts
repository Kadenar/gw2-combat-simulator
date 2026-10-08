import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Owns HGH's elixir cast effects and scheduled-event duration extension. */

export function isElixirSkill(skill: EngineerSkill | undefined): boolean {
  return Boolean(skill?.categories?.some((category) => category.toLowerCase() === 'elixir'));
}

/** Schedules Acid Bomb's extended final pulse while HGH is selected. */
export function applyHghAcidBomb(context: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  const skill = cast.skill;
  if (!hasTrait(context.traits, TRAIT.HGH) || skill.id !== ID.ACID_BOMB) return;

  const hghProfile = requireBalanceProfileFromContext(context, TRAIT.HGH);
  const strike = requireEffect(hghProfile, 'strike', 'HGH');
  if (strike) {
    buildEngineerPackets(
      'damage',
      {
        at: cast.fullEnd + 6,
        activationId: cast.id,
        weaponStrengthProfileId: strike.weaponStrengthProfileId,
        coefficient: Number(strike.coefficient),
        hits: Number(strike.hits),
        name: 'Acid Bomb',
        actorType: 'player'
      },
      skill
    ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }
}

/** Extends scheduled elixir fields, boons, and conditions while HGH is selected. */
export function prepareEngineerHghEvent(context: EngineerRuntime, event: SimulationEventBase): SimulationEventBase {
  if (!hasTrait(context.traits, TRAIT.HGH) || event.sourceId === TRAIT.HGH) return event;
  const skill = skillForEvent(context.helpers, event);
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
