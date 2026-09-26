import { normalizeEffectMetadata } from '#gw2/platform/engine/effects/contracts.js';
import { buildResolverBuff, buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { proceduralSkillWeapon, splitStrikeHits } from '#gw2/platform/simulation/procedural-emission.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Procedural packets retain explicit source identities and the owning cast's targeting policy. */
type Packet = Partial<SimulationEventBase> & {
  fixedDuration?: boolean;
  coefficient?: number;
  hits?: number;
  hitIndex?: number;
  totalHits?: number;
  canCrit?: boolean;
  noCrit?: boolean;
  skillWeapon?: string;
  stacks?: number;
  condition?: string;
  controlKind?: string;
} & { at: number; skill?: Skill; cause?: Gw2ResolverEvent; interval?: number };
const emissions = new WeakMap<ElementalistRuntime, RuntimeCast>();

/** Captures cast ownership only while a lifecycle callback materializes its procedural packets. */
export function withElementalistCast(runtime: ElementalistRuntime, cast: RuntimeCast, callback: () => void): void {
  const previous = emissions.get(runtime);
  emissions.set(runtime, cast);
  try {
    callback();
  } finally {
    if (previous) emissions.set(runtime, previous);
    else emissions.delete(runtime);
  }
}

/** Procedural packets inherit the owning cast's activation and targeting while a lifecycle callback runs. */
export function emitElementalistPacket(
  runtime: ElementalistRuntime,
  event: SimulationEventBase,
  cause?: Gw2ResolverEvent
): void {
  const cast = emissions.get(runtime);
  runtime.emitProcedural(
    { ...(cast ? { activationId: cast.id, offTarget: cast.command.offTarget } : {}), ...event },
    { cause }
  );
}

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

/** Splits a procedural coefficient into its authored hit sequence without predicting any accepted-hit rewards. */
export function emitElementalistDamage(runtime: ElementalistRuntime, packet: Packet & { coefficient: number }): void {
  // Trait and effect packets own their strength roll independently of the triggering cast.
  if (packet.activationId == null && packet.actorType === 'effect')
    packet = { ...packet, activationId: 'elementalist.effect:' + ++runtime.weaponStrengthActivationOrder };
  const { at, coefficient, hits, hitIndex, totalHits } = packet;
  for (const hit of splitStrikeHits({ at, coefficient, hits, hitIndex, totalHits }, Number(packet.interval ?? 0)))
    emitElementalistPacket(
      runtime,
      buildResolverStrike({
        ...fields(packet),
        ...hit,
        skillWeapon: packet.skillWeapon ?? (packet.skill ? proceduralSkillWeapon(packet.skill) : ''),
        canCrit: packet.canCrit !== false
      }),
      packet.cause
    );
}

/** Conditions retain unscaled duration for the shared application owner. */
export function emitElementalistCondition(
  runtime: ElementalistRuntime,
  packet: Packet & { condition: string; stacks: number; duration: number }
): void {
  emitElementalistPacket(
    runtime,
    buildResolverCondition({
      ...fields(packet),
      condition: packet.condition,
      stacks: packet.stacks,
      duration: packet.duration
    }),
    packet.cause
  );
}

/** Positive effects share one duration-scaling path at the actual application boundary. */
export function emitElementalistBuff(
  runtime: ElementalistRuntime,
  packet: Packet & { kind: string; duration: number }
): void {
  emitElementalistPacket(
    runtime,
    buildResolverBuff({ ...fields(packet), kind: packet.kind, duration: packet.duration, stacks: packet.stacks ?? 1 }),
    packet.cause
  );
}

/** Procedural controls join the same accepted-control and combo pipeline as authored effects. */
export function emitElementalistControl(runtime: ElementalistRuntime, packet: Packet): void {
  emitElementalistPacket(
    runtime,
    { ...fields(packet), type: 'control', at: packet.at, controlKind: packet.controlKind ?? 'crowd-control' },
    packet.cause
  );
}
