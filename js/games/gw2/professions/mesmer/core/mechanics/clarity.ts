import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
/** Owns the Clarity window that one spear cast arms and a later spear cast consumes. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
/** Consume once at acceptance; canceled casts retain this start cost. */
export function consumeMesmerClarity(state: MesmerRuntime, castStart: number): boolean {
  const consumed = professionCoreState(state).clarityUntil > castStart;
  professionCoreState(state).clarityUntil = 0;
  return consumed;
}

/** Track the skill's applied Clarity buff for consumption and publish its existing proc indicator. */
export function applyMesmerClarity(state: MesmerRuntime, event: Gw2ResolverEvent): void {
  if (event.kind !== 'clarity' || !event.resolvedAudience?.includesSelf) return;
  const duration = Number(event.duration);
  professionCoreState(state).clarityUntil = event.at + duration;
  state.emitDerived(event, {
    type: 'proc',
    procType: 'skill',
    at: event.at,
    source: event.source,
    sourceId: event.sourceId,
    actorType: 'player',
    skillId: event.skillId,
    activationId: event.activationId,
    name: 'Clarity',
    sourceSkill: event.skillName,
    detail: `Spear skills 3-5 empowered for ${duration}s`,
    icon: event.icon
  });
}
