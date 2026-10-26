import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { splitStrikeHits } from '#gw2/platform/effects/packet-builders.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';

/** Cast and trait effects supply their own attribution; pet ownership is captured by the pet producer. */
export function buildRangerPacket(
  fields: Pick<SimulationEventBase, 'at'> & Partial<SimulationEventBase>,
  type: string
): Gw2ResolverEvent {
  return {
    source: 'ranger',
    sourceId: fields.skillId ?? 'ranger',
    actorType: ACTOR.PLAYER,
    name: fields.skillName,
    ...fields,
    type
  } as Gw2ResolverEvent;
}

/** A proc's total coefficient is divided into ordered hits, each with an independent resolved-hit fact. */
export function buildRangerStrikes(event: SimulationEventBase): SimulationEventBase[] {
  return splitStrikeHits({ ...event, type: 'damage', coefficient: Number(event.coefficient) });
}

/** Attribution and delivery fields for a profile payload that a resolved hit or mechanic delivers. */
export interface RangerProfileDelivery {
  readonly attribution: EffectEventBase;
  /** The log label for each delivered packet, independent of the profile's patch-facing name. */
  readonly name?: string;
  /** Actor-specific packet fields, such as an independent pet's combat attributes or a party audience. */
  readonly fields?: Partial<SimulationEventBase>;
  /** Duration modifiers sample the triggering hit instead of the granting mechanic. */
  readonly durationContext?: Gw2ResolverEvent;
}

/** Profiles own the payload values; the mechanic owns timing, attribution, and log identity. */
export function emitRangerProfile(
  context: Pick<MechanicCombatContext, 'effects'>,
  at: number,
  profile: Skill | BalanceProfile,
  delivery: RangerProfileDelivery
): void {
  context.effects.emit({
    kind: 'profile',
    profile,
    at,
    fullEnd: at,
    attribution: delivery.attribution,
    durationContext: delivery.durationContext,
    transform: (packet) => ({
      ...packet,
      ...(delivery.name != null ? { name: delivery.name } : {}),
      ...delivery.fields
    })
  });
}

/** Deliver only the selected action's payload; ordinary skill packets never leak into triggered follow-ups. */
export function emitRangerAction(
  context: Pick<MechanicCombatContext, 'effects'>,
  at: number,
  skill: Skill,
  actionId: string,
  delivery: RangerProfileDelivery
): void {
  const action = requireSkillAction(skill, actionId);
  context.effects.emit({
    kind: 'profile',
    profile: skill,
    effects: action.effects,
    at,
    fullEnd: at,
    attribution: delivery.attribution,
    durationContext: delivery.durationContext,
    transform: (packet) => ({
      ...packet,
      ...(delivery.name != null ? { name: delivery.name } : {}),
      ...delivery.fields
    })
  });
}
