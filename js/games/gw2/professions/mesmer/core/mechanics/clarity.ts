import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/** Owns the Clarity window that one spear cast arms and a later spear cast consumes. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerAddEvent, MesmerMechanics } from '#gw2/professions/mesmer/types.js';

const CLARITY_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png';
const CLARITY_CONSUMERS = new Set<number>([ID.IMAGINARY_INVERSION, ID.PHANTASMAL_LANCER, ID.MENTAL_COLLAPSE]);

/** Consumes Clarity at cast start only for the spear skills it empowers. */
export function consumeMesmerClarity(state: MesmerRuntime, skill: MesmerSkill, castStart: number): boolean {
  const consumed = CLARITY_CONSUMERS.has(skill.id) && professionCoreState(state).clarityUntil > castStart;
  if (CLARITY_CONSUMERS.has(skill.id)) professionCoreState(state).clarityUntil = 0;
  return consumed;
}

/** Opens Clarity when Mind the Gap resolves and publishes the visible proc event. */
export function applyMesmerClarity(
  state: MesmerRuntime,
  balanceProfile: MesmerMechanics['balanceProfile'],
  addEvent: MesmerAddEvent,
  skill: MesmerSkill,
  at: number
): void {
  if (skill.id !== ID.MIND_THE_GAP) return;
  const clarityProfile = requireBalanceProfileFromContext(balanceProfile, 'mesmer.core.clarity');
  professionCoreState(state).clarityUntil = at + balanceProfileNumber(clarityProfile, 'durationMultiplier');
  addEvent({
    type: 'proc',
    procType: 'skill',
    at,
    name: 'Clarity',
    sourceSkill: skill.name,
    detail: 'Spear skills 3-5 empowered for 15s',
    icon: CLARITY_ICON
  });
}
