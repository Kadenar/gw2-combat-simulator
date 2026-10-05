import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
/** Owns the Clarity window that one spear cast arms and a later spear cast consumes. */
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
/** Consume once at acceptance; canceled casts retain this start cost. */
export function consumeMesmerClarity(state: MesmerRuntime, castStart: number): boolean {
  return consumeCharge(professionCoreState(state).clarity, castStart);
}

/** Track the skill's applied Clarity buff for consumption and publish its existing proc indicator. */
export function applyMesmerClarity(state: MesmerRuntime, event: Gw2ResolverEvent): void {
  if (event.kind !== 'clarity' || !event.resolvedAudience?.includesSelf) return;
  const duration = Number(event.duration);
  // Reapplication replaces the entitlement and its authored deadline rather than stacking charges.
  professionCoreState(state).clarity = grantCharges(1, event.at + duration);
  state.effects.emit({
    kind: 'announcement',
    cause: event,
    log: true,
    attribution: {
      source: event.source,
      sourceId: event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      activationId: event.activationId
    },
    announcement: {
      type: 'skill',
      at: event.at,
      name: 'Clarity',
      sourceSkill: event.skillName,
      detail: `Spear skills 3-5 empowered for ${duration}s`,
      icon: event.icon
    }
  });
}
