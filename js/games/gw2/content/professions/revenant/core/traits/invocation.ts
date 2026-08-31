/** Owns Core Invocation trait behavior triggered by a completed legend swap. */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/core/skills/index.js';
import {
  emitLegendInvocationProfile,
  emitLegendInvocationSkill
} from '#gw2/content/professions/revenant/core/traits/invocation-effects.js';
import type { RevenantCastContext } from '#gw2/content/professions/revenant/types.js';

export { emitLegendInvocationProfile, emitLegendInvocationSkill };

const CORE_LEGENDS = new Set<string>([LEGEND.ASSASSIN, LEGEND.DEMON, LEGEND.DWARF, LEGEND.CENTAUR]);

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
