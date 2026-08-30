import type { SchedulerRecord, SimulationEvent, Skill } from '../../../../../../platform/engine/types.js';
import {
  DRAGON_CHARGE_INTERVAL_SECONDS,
  DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
  dragonSlashCoefficient,
  projectDragonCharges,
  type DragonFlowRateSegment
} from './dragon-trigger.js';
import { ENTER_DRAGON_TRIGGER_REASON } from './gunsaber-and-trigger-rules.js';

function eventRotationIndex(event: SimulationEvent): number | null {
  const rotationIndex = Number(event.rotationIndex);
  return Number.isInteger(rotationIndex) ? rotationIndex : null;
}

// Finds the most recent Dragon Trigger entry that has not yet been released.
// An entry is considered released when a "profession mechanic" dragon-charges
// resource event with a later rotationIndex exists in the event list.
function activeDragonTriggerEntry(events: readonly SimulationEvent[], insertionIndex: number): SimulationEvent | null {
  const entries = events
    .filter((event) => {
      const rotationIndex = eventRotationIndex(event);
      return (
        event.type === 'resource' &&
        event.reason === DRAGON_TRIGGER_ENTRY_RESOURCE_REASON &&
        rotationIndex != null &&
        rotationIndex < insertionIndex
      );
    })
    .sort((left, right) => Number(eventRotationIndex(left)) - Number(eventRotationIndex(right)));
  const entry = entries.at(-1) || null;
  if (!entry) return null;
  const entryIndex = Number(eventRotationIndex(entry));
  const released = events.some((event) => {
    const rotationIndex = eventRotationIndex(event);
    return (
      event.type === 'resource' &&
      event.reason === 'profession mechanic' &&
      event.resource === 'dragon charges' &&
      rotationIndex != null &&
      rotationIndex > entryIndex &&
      rotationIndex < insertionIndex
    );
  });
  return released ? null : entry;
}

// Validate serialized Flow-rate segments from the Dragon Trigger entry event
// before using them in release projection.
function flowRateSegments(value: unknown): readonly DragonFlowRateSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const segment = candidate as SchedulerRecord;
    const start = Number(segment.start);
    const end = Number(segment.end);
    const flowPerSecond = Number(segment.flowPerSecond);
    return Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(flowPerSecond) && end > start
      ? [{ start, end, flowPerSecond }]
      : [];
  });
}

// Reconstruct the active Dragon Trigger window at an insertion point and project
// the earliest reachable Flow, charge, coefficient, and failure reason per tier.
export function dragonChargeReleaseProjection(context: {
  readonly events?: readonly SimulationEvent[];
  readonly insertionIndex?: number;
  readonly skill?: Skill;
}): SchedulerRecord {
  const events = context.events || [];
  const insertionIndex = Number(context.insertionIndex);
  const skill = context.skill;
  const entry = activeDragonTriggerEntry(events, insertionIndex);
  if (!entry || !skill) {
    return { rows: [], unavailableMessage: ENTER_DRAGON_TRIGGER_REASON };
  }

  const startTime = Number(entry.at);
  const firstTickAt = Number(entry.nextChargeAt);
  const deadline = Number(entry.deadline);
  const maximumCharges = Math.max(1, Number(entry.maximumCharges));
  const chargesPerInterval = Math.max(1, Number(entry.chargesPerInterval));
  const projection = projectDragonCharges({
    startTime,
    firstTickAt,
    flow: Number(entry.value),
    maximumFlow: Number(entry.maximumFlow),
    maximumCharges,
    chargesPerInterval,
    flowPerInterval: Number(entry.flowPerInterval),
    flowRateSegments: flowRateSegments(entry.flowRateSegments),
    deadline
  });
  const minimum = Number(skill.dragonSlashMinimumCoefficient || 0);
  const maximum = Number(skill.dragonSlashMaximumCoefficient || minimum);
  const chargeLevels: number[] = [];
  for (let charges = chargesPerInterval; charges < maximumCharges; charges += chargesPerInterval) {
    chargeLevels.push(charges);
  }

  chargeLevels.push(maximumCharges);

  const stalled = projection.some((tick) => !tick.granted);
  return {
    rows: chargeLevels.map((charges, index) => {
      const tick = projection.find((candidate) => candidate.granted && candidate.charges === charges);
      const earliestAt = firstTickAt + index * DRAGON_CHARGE_INTERVAL_SECONDS;
      const pastDeadline = earliestAt > deadline + 1e-9;
      return {
        charges,
        at: tick?.at ?? earliestAt,
        delta: (tick?.at ?? earliestAt) - startTime,
        flowAfter: tick?.flowAfter ?? null,
        coefficient: dragonSlashCoefficient(minimum, maximum, charges, maximumCharges),
        disabled: !tick,
        reason: tick
          ? ''
          : pastDeadline
            ? 'Past the Dragon Trigger deadline.'
            : stalled
              ? 'Insufficient Flow before Dragon Trigger ended.'
              : 'Unreachable in this charge window.'
      };
    })
  };
}
