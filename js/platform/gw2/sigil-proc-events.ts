import type { SimulationEvent, SimulationEventInput } from "../engine/types.js";
import type { Gw2SigilProc } from "./types.js";

export const RESOLVER_CRITICAL_SIGILS = Object.freeze(
  new Set(["Air", "Earth", "Torment"]),
);

export const GW2_SCHEDULER_SIGIL_PREDICTION = "critical-sigil";

export function isResolverCriticalSigil(name: string): boolean {
  return RESOLVER_CRITICAL_SIGILS.has(name);
}

export function isSchedulerSigilPrediction(event: SimulationEvent): boolean {
  return event.schedulerPrediction === GW2_SCHEDULER_SIGIL_PREDICTION;
}

function commonSigilEvent(
  name: string,
  sourceSkill: string,
): Pick<
  SimulationEventInput,
  "name" | "skillName" | "source" | "sourceId" | "actorType"
> & { readonly triggeredBy: string } {
  return {
    name: `Sigil of ${name}`,
    skillName: `Sigil of ${name}`,
    source: "Sigil",
    sourceId: `sigil.${name.toLowerCase()}`,
    actorType: "effect",
    triggeredBy: sourceSkill,
  };
}

/** Builds the canonical strike packet shared by scheduler and resolver sigils. */
export function createSigilStrikeEvent(
  name: string,
  proc: Gw2SigilProc,
  sourceSkill: string,
): SimulationEventInput {
  return {
    ...commonSigilEvent(name, sourceSkill),
    type: "damage",
    at: 0,
    coefficient: proc.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    weaponStrength: proc.weaponStrength,
    skillWeapon: "Unequipped",
    noCrit: !proc.canCrit,
    canTriggerCriticalSigils: proc.canCrit === true,
    canTriggerCriticalTraits: proc.canCrit === true,
  };
}

/** Builds the canonical condition packet shared by scheduler and resolver sigils. */
export function createSigilConditionEvent(
  name: string,
  proc: Gw2SigilProc,
  sourceSkill: string,
): SimulationEventInput {
  return {
    ...commonSigilEvent(name, sourceSkill),
    type: "condition",
    at: 0,
    name: `Sigil of ${name} — ${String(proc.condition || "")}`,
    condition: proc.condition,
    duration: proc.duration,
    stacks: proc.stacks,
  };
}
