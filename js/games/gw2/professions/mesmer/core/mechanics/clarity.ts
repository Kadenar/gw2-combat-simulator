import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/** Owns the Clarity window that one spear cast arms and a later spear cast consumes. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerState } from '#gw2/platform/execution/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type {
  MesmerAddEvent,
  MesmerHandlerContext,
  MesmerRuntime,
  MesmerRuntimeState
} from '#gw2/professions/mesmer/types.js';
import { scheduleDeclarativeEffects } from '#gw2/platform/execution/effect-adapter.js';

const CLARITY_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png';
const CLARITY_CONSUMERS = new Set<number>([ID.IMAGINARY_INVERSION, ID.PHANTASMAL_LANCER, ID.MENTAL_COLLAPSE]);

/** Clarity belongs to the accepted activation, even if another spear cast changes state before impact. */
export function scheduleClarityEffects(context: MesmerHandlerContext, skill: MesmerSkill): void {
  if (context.action.cancelled || !context.mesmerRuntime.castDetails.get(context.reservationId)?.clarityConsumed)
    return;
  scheduleDeclarativeEffects(
    context,
    { ...skill, effects: skill.clarityEffects || [] },
    context.reservationId,
    context.start,
    context.fullEnd,
    context.effectiveEnd
  );
}

/** Consumes Clarity at cast start only for the spear skills it empowers. */
export function consumeMesmerClarity(
  state: SchedulerState<MesmerRuntimeState>,
  skill: MesmerSkill,
  castStart: number
): boolean {
  const consumed = CLARITY_CONSUMERS.has(skill.id) && professionCoreState(state).clarityUntil > castStart;
  if (CLARITY_CONSUMERS.has(skill.id)) professionCoreState(state).clarityUntil = 0;
  return consumed;
}

/** Opens Clarity when Mind the Gap resolves and publishes the visible proc event. */
export function applyMesmerClarity(
  state: SchedulerState<MesmerRuntimeState>,
  balanceProfile: MesmerRuntime['balanceProfile'],
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
