import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export function emitPacket(runtime: NecromancerRuntime, cast: RuntimeCast, event: SimulationEventBase): void {
  runtime.emit({
    ...event,
    activationId: cast.id,
    offTarget: cast.command.offTarget,
    at: canonicalTime(event.at + (isHostileTargetEvent(event) ? (cast.command.impactDelayMs ?? 0) / 1000 : 0))
  });
}

export function party(runtime: NecromancerRuntime) {
  return {
    recipients: 'party' as const,
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
  };
}
