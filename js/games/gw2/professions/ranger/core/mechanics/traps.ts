import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SimulationEvent, SimulationEventInput } from '#gw2/platform/engine/events/types.js';
import type { RangerSchedulerContext } from '#gw2/professions/ranger/types.js';

/** A precast Frost Trap stays armed until combat instead of losing pulses before the target arrives. */
export function prepareRangerTrapEvent(
  context: RangerSchedulerContext,
  event: SimulationEventInput
): SimulationEventInput {
  if (
    context.hasExplicitCombatStart &&
    context.combatStartTime == null &&
    event.skillId === ID.FROST_TRAP &&
    event.cancelled !== true &&
    ['damage', 'condition', 'combo_field'].includes(event.type)
  ) {
    professionCoreState(context).pendingFrostTrapEvents.push(event);
    return { ...event, cancelled: true, offTarget: true };
  }

  return event;
}

/** Release the complete pulse train and ice field together, never earlier than the trap's arming time. */
export function triggerRangerPrecastTrap(context: RangerSchedulerContext, event: SimulationEvent): void {
  if (event.type !== 'combat_start') return;
  const state = professionCoreState(context);
  const pending = state.pendingFrostTrapEvents;
  state.pendingFrostTrapEvents = [];
  const firstAt = Math.min(...pending.map((packet) => packet.at));
  const delay = Math.max(0, event.at - firstAt);
  for (const packet of pending) {
    context.emit({
      ...packet,
      at: packet.at + delay,
      ...(packet.type === 'combo_field' ? { expiresAt: Number(packet.expiresAt) + delay } : {})
    });
  }
}
