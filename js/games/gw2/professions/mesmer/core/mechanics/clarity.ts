/** Owns the Clarity window that one spear cast arms and a later spear cast consumes. */
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

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
      actorType: ACTOR.PLAYER,
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

/** Capture the consumed entitlement before effect selection so every effect uses the same accepted Clarity state. */
export function captureMesmerClarity(runtime: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  runtime.profession.core.castDetails.get(cast.id)!.clarityConsumed = consumeMesmerClarity(runtime, cast.start);
}

/** Emit only the skill's Clarity reward with the accepted cast's delivery and attribution. */
export function grantMesmerClarity(runtime: MesmerRuntime, skill: MesmerSkill, delivery: EffectDelivery): void {
  runtime.effects.emit({
    ...delivery,
    kind: 'profile',
    profile: {
      ...skill,
      effects: skill.effects?.filter((effect) => effect.type === 'buff' && effect.kind === 'clarity')
    },
    at: runtime.time,
    fullEnd: runtime.time,
    attribution: {
      source: 'Player',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name
    },
    priority: 0
  });
}
