/** Owns Core Invocation trait behavior triggered by a completed legend swap. */
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import {
  requireRevenantBalanceProfile,
  requireRevenantEffect
} from '#gw2/professions/revenant/core/traits/profile-access.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import {
  emitLegendInvocationProfile,
  emitLegendInvocationSkill
} from '#gw2/professions/revenant/core/traits/invocation-effects.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

export { emitLegendInvocationProfile, emitLegendInvocationSkill };

const CORE_LEGENDS = new Set<string>([LEGEND.ASSASSIN, LEGEND.DEMON, LEGEND.DWARF, LEGEND.CENTAUR]);

/** Reacts to player-owned Fury received by the player, preserving the triggering event's cause. */
export function applyIncensedResponse(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (
    event.type !== 'buff' ||
    event.kind !== 'fury' ||
    !hasTrait(context, TRAIT.INCENSED_RESPONSE) ||
    !isGw2PlayerModifierOwnedEvent(event) ||
    !gw2BoonApplicationRecipients(context.config, event).includesSelf
  )
    return;
  const profile = requireRevenantBalanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.incensedResponse);
  const effect = requireRevenantEffect(profile, 'boon');
  emitSkillBuff(context, profile as RevenantSkill, {
    cause: event,
    at: event.at,
    kind: String(effect.boon),
    duration: Number(effect.duration),
    stacks: Number(effect.stacks)
  });
}

/** Applies Spirit Boon's legend-specific boon package when the destination is a Core legend. */
export function applySpiritBoon(context: RevenantCastContext, legendId: string, at: number): void {
  if (!CORE_LEGENDS.has(legendId) || !hasTrait(context.config, TRAIT.SPIRIT_BOON)) return;
  emitLegendInvocationProfile(
    context,
    REVENANT_CORE_BALANCE_PROFILE_IDS.spiritBoon,
    at,
    TRAIT.SPIRIT_BOON,
    (effect) => effect.metadata?.legendId === legendId
  );
}

/** Applies Song of the Mists' legend-specific packet when the destination is a Core legend. */
export function applySongOfTheMists(context: RevenantCastContext, legendId: string, at: number): void {
  if (!CORE_LEGENDS.has(legendId) || !hasTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) return;
  emitLegendInvocationProfile(
    context,
    REVENANT_CORE_BALANCE_PROFILE_IDS.songOfTheMists,
    at,
    TRAIT.SONG_OF_THE_MISTS,
    (effect) => effect.metadata?.legendId === legendId
  );
}
