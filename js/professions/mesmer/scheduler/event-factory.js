import {
  createGw2SchedulerEventFactory,
} from "../../../platform/gw2/scheduler/event-factory.js";

/**
 * Configures the shared GW2 scheduler event factory with Mesmer's deterministic
 * expected-proc candidates.
 */
export function createEventFactory(options) {
  const {
    queueExpectedProc,
  } = options;

  return createGw2SchedulerEventFactory({
    ...options,
    onConditionScheduled(event) {
      if (event.condition !== "Bleeding") return;
      queueExpectedProc({
        type: "bleeding",
        at: event.at,
        stacks: event.stacks,
        source: event.source,
        cloneId: event.cloneId,
        sourceSkill: event.skillName,
      });
    },
    onDamageScheduled(event, { activeWeaponSet }) {
      queueExpectedProc({
        type: "hit",
        at: event.at,
        hits: 1,
        source: event.source,
        blade: event.blade,
        cloneId: event.cloneId,
        sourceSkill: event.skillName,
        weaponSet: activeWeaponSet,
      });
    },
  });
}
