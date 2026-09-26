import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerCoreState } from '#gw2/professions/ranger/core/state.js';

export const RANGER_SPEAR_STEALTH_FLIP_BY_PARENT: Readonly<Record<number, number>> = Object.freeze({
  [ID.MONGOOSES_FRENZY]: ID.WOLFS_ONSLAUGHT,
  [ID.FALCONS_STOOP]: ID.OWLS_FLIGHT,
  [ID.WARCLAWS_ENGAGE]: ID.PREDATORS_AMBUSH,
  [ID.PANTHERS_PROWL]: ID.SPIDERS_WEB
});

/** Hunter's Prowess survives Revealed; ordinary stealth enables the same spear choices until broken. */
export function rangerSpearStealthAvailable(state: Partial<RangerCoreState>, at: number): boolean {
  return (
    skillFlipReady(state.availableFlips?.[ID.WOLFS_ONSLAUGHT], at) ||
    (Number(state.stealthUntil || 0) > at && Number(state.revealedUntil || 0) <= at)
  );
}
