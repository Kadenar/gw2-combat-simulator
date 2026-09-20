import { timeKey } from '#kernel/core/clock.js';
import type { SimulationEvent, SimulationEventInput } from '#gw2/platform/engine/events/events.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';

export const GW2_SCHEDULER_SIGIL_PREDICTION = 'critical-sigil';

/** Both adapters use the same supported packet kinds; unsupported authored effects cannot silently become conditions. */
export function createCriticalSigilEvent(name: string, proc: Gw2SigilProc, sourceSkill: string): SimulationEventInput {
  if (proc.effect === 'strike') return createSigilStrikeEvent(name, proc, sourceSkill);
  if (proc.effect === 'condition') return createSigilConditionEvent(name, proc, sourceSkill);
  throw new TypeError(`Unsupported critical sigil effect: ${name} (${proc.effect}).`);
}

/** Lets a sigil retrigger at its exact canonical ICD boundary without opening an early-proc window. */
export function isSigilInternalCooldownReady(at: number, readyAt = 0): boolean {
  return timeKey(at) >= timeKey(readyAt);
}

/** Reports whether an event is a scheduler-only sigil prediction. */
export function isSchedulerSigilPrediction(event: SimulationEvent): boolean {
  return event.schedulerPrediction === GW2_SCHEDULER_SIGIL_PREDICTION;
}

function commonSigilEvent(
  name: string,
  sourceSkill: string
): Pick<SimulationEventInput, 'name' | 'skillName' | 'source' | 'sourceId' | 'actorType' | 'ownerActorType'> & {
  readonly triggeredBy: string;
} {
  return {
    name: `Sigil of ${name}`,
    skillName: `Sigil of ${name}`,
    source: 'Sigil',
    sourceId: `sigil.${name.toLowerCase()}`,
    actorType: 'effect',
    ownerActorType: 'player',
    triggeredBy: sourceSkill
  };
}

/** Builds the canonical strike packet shared by scheduler and resolver sigils. */
export function createSigilStrikeEvent(name: string, proc: Gw2SigilProc, sourceSkill: string): SimulationEventInput {
  return {
    ...commonSigilEvent(name, sourceSkill),
    type: 'damage',
    at: 0,
    coefficient: proc.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    weaponStrength: proc.weaponStrength,
    skillWeapon: 'Unequipped',
    noCrit: !proc.canCrit,
    canTriggerCriticalSigils: proc.canCrit === true,
    canTriggerCriticalTraits: proc.canCrit === true
  };
}

/** Builds the canonical condition packet shared by scheduler and resolver sigils. */
export function createSigilConditionEvent(name: string, proc: Gw2SigilProc, sourceSkill: string): SimulationEventInput {
  return {
    ...commonSigilEvent(name, sourceSkill),
    type: 'condition',
    at: 0,
    name: `Sigil of ${name} — ${String(proc.condition || '')}`,
    condition: proc.condition,
    duration: proc.duration,
    stacks: proc.stacks
  };
}
