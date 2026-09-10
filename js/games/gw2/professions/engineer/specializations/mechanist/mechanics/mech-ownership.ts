import type { EngineerSimulationEvent, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Only F1-F3 are mech commands; the summon/recall slot is excluded. */
export function isEngineerMechCommand(skill: EngineerSkill | undefined): boolean {
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

/** Explicit ownership wins; each caller controls whether its context permits legacy command inference. */
export function isEngineerMechEvent(
  event: EngineerSimulationEvent | undefined,
  skill: () => EngineerSkill | undefined,
  allowInference = true
): boolean {
  return (
    event?.metadata?.engineerMech === true ||
    event?.application?.metadata?.engineerMech === true ||
    (allowInference && event?.actorType === 'summon' && isEngineerMechCommand(skill()))
  );
}
