import { canonicalTime } from '#kernel/core/clock.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import type {
  ElementalistSkill,
  ElementalistRuntime,
  ElementalistSimulationEvent
} from '#gw2/professions/elementalist/types.js';
import { emitElementalistDamage } from '#gw2/professions/elementalist/core/events.js';
import { empowerElementalistSpearPacket } from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

const FULGOR_OWNER = { id: 'elementalist.fulgor', generation: 0 };

/** Pending work owns the snapshot, so completion or cancellation needs no separate state cleanup. */
interface FulgorSequence {
  packets: ElementalistSimulationEvent[];
  empowerment: ElementalistCoreState['spearFollowups'][string] | undefined;
}

function scheduleNextPulse(context: ElementalistRuntime, sequence: FulgorSequence): void {
  if (sequence.packets.length)
    context.schedule('elementalist.fulgor-pulse', sequence.packets[0].at, sequence, FULGOR_OWNER);
}

/** A committed recast replaces only the procedural stream; ordinary strikes keep their existing lifetime. */
export function replaceFulgor(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const profile = requireBalanceProfileFromContext(context, PROFILE.fulgor);
  const pulse = requireEffect(profile, 'strike', 'Fulgor');
  if (!pulse?.ticks?.length) throw new TypeError('Fulgor requires an explicit strike timeline.');
  context.cancelOwner(FULGOR_OWNER);
  const packets: ElementalistSimulationEvent[] = pulse.ticks.map((tick) => ({
    type: 'damage',
    at: canonicalTime(Math.max(context.time, cast.start + tick.atMs / 1000)),
    source: cast.skill.name,
    sourceId: cast.skill.id,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: cast.skill.name,
    skillId: cast.skill.id,
    coefficient: tick.coefficient,
    flatStrikeBase: Number(tick.flatStrikeBase),
    flatStrikePowerCoeff: Number(tick.flatStrikePowerCoeff),
    canCrit: false,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  }));
  scheduleNextPulse(context, {
    packets,
    empowerment: context.profession.core.spearFollowups[cast.id]
  });
}

/** Carry the consumed control flag forward with the remaining pulses, releasing the snapshot after the last one. */
export function fulgorPulse(context: ElementalistRuntime, data: unknown): void {
  const {
    packets: [packet, ...remaining],
    empowerment
  } = data as FulgorSequence;
  const empowered = empowerElementalistSpearPacket(context, packet, empowerment);
  emitElementalistDamage(context, { ...empowered, coefficient: Number(empowered.coefficient) });
  scheduleNextPulse(context, { packets: remaining, empowerment });
}
