import { normalizeEffectMetadata } from '#gw2/platform/engine/effects/contracts.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { EffectDelivery, PacketEmission, ProfileEmission } from '#gw2/platform/simulation/effect-emission.js';
import { proceduralSkillWeapon, splitStrikeHits } from '#gw2/platform/simulation/procedural-emission.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
/** Procedural packets retain explicit source identities and the owning cast's targeting policy. */
type Packet = Partial<SimulationEventBase> & {
  fixedDuration?: boolean;
  coefficient?: number;
  hits?: number;
  hitIndex?: number;
  totalHits?: number;
  canCrit?: boolean;
  skillWeapon?: string;
  stacks?: number;
  condition?: string;
  controlKind?: string;
} & {
  at: number;
  skill?: Skill;
  cause?: Gw2ResolverEvent;
  interval?: number;
};
/** Normalizes the procedural envelope before the shared runtime validates and queues it. */
function fields(packet: Packet) {
  const { skill, cause: _cause, interval: _interval, ...rest } = packet;
  const id = rest.skillId ?? rest.sourceId ?? skill?.id ?? 'elementalist.procedural';
  const name = rest.skillName ?? skill?.name ?? String(rest.name || id);
  return {
    source: 'elementalist',
    sourceId: skill?.id ?? id,
    actorType: 'player' as const,
    skillId: skill?.id ?? id,
    skillName: name,
    ...rest,
    metadata: normalizeEffectMetadata(rest.metadata)
  };
}

/** Selects the authored hit plan; only the shared service expands and publishes its effects. */
export function elementalistStrikeRequest(
  runtime: ElementalistRuntime,
  packet: Packet & {
    coefficient: number;
  },
  emissionCast?: EffectDelivery['cast']
): ProfileEmission {
  if (packet.activationId == null && packet.actorType === 'effect')
    packet = { ...packet, activationId: 'elementalist.effect:' + ++runtime.weaponStrengthActivationOrder };
  const attribution = fields(packet);
  const hits = splitStrikeHits(
    {
      at: packet.at,
      coefficient: packet.coefficient,
      hits: packet.hits,
      hitIndex: packet.hitIndex,
      totalHits: packet.totalHits
    },
    packet.interval ?? 0
  );
  return {
    kind: 'profile',
    profile: packet.skill ?? { id: attribution.skillId ?? attribution.sourceId, name: attribution.skillName },
    at: packet.at,
    fullEnd: packet.at,
    cause: packet.cause,
    cast: emissionCast,
    attribution,
    effects: [
      {
        type: 'strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        ticks: hits.map((hit) => ({ atMs: (hit.at - packet.at) * 1000, coefficient: hit.coefficient })),
        canCrit: packet.canCrit !== false
      }
    ],
    transform: (event) => ({
      ...attribution,
      ...event,
      skillWeapon: packet.skillWeapon ?? (packet.skill ? proceduralSkillWeapon(packet.skill) : ''),
      hitIndex: packet.hitIndex ?? event.hitIndex,
      totalHits: packet.totalHits ?? event.totalHits
    })
  };
}

/** Conditions retain authored duration for the shared application transaction. */
export function elementalistConditionRequest(
  packet: Packet & {
    condition: string;
    stacks: number;
    duration: number;
  },
  emissionCast?: EffectDelivery['cast']
): PacketEmission {
  return {
    kind: 'packet',
    cause: packet.cause,
    cast: emissionCast,
    event: buildResolverCondition({
      ...fields(packet),
      condition: packet.condition,
      stacks: packet.stacks,
      duration: packet.duration
    })
  };
}

/** Boon duration is sampled once when the shared service dispatches the application. */
export function elementalistBuffRequest(
  packet: Packet & {
    kind: string;
    duration: number;
  },
  emissionCast?: EffectDelivery['cast']
): PacketEmission {
  return {
    kind: 'packet',
    cause: packet.cause,
    cast: emissionCast,
    event: buildResolverBuff({
      ...fields(packet),
      kind: packet.kind,
      duration: packet.duration,
      stacks: packet.stacks ?? 1
    })
  };
}

/** Controls retain their authored category while joining the shared accepted-control pipeline. */
export function elementalistControlRequest(packet: Packet, emissionCast?: EffectDelivery['cast']): PacketEmission {
  return {
    kind: 'packet',
    cause: packet.cause,
    cast: emissionCast,
    event: { ...fields(packet), type: 'control', at: packet.at, controlKind: packet.controlKind ?? 'crowd-control' }
  };
}
