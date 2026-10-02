import { SIGIL_BY_ID } from '#gw2/platform/equipment/sigils/data.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';

/** Both adapters use the same supported packet kinds; unsupported authored effects cannot silently become conditions. */
export function createCriticalSigilEvent(id: number, proc: Gw2SigilProc, sourceSkill: string): SimulationEventBase {
  if (proc.effect === 'strike') return createSigilStrikeEvent(id, proc, sourceSkill);
  if (proc.effect === 'condition') return createSigilConditionEvent(id, proc, sourceSkill);
  throw new TypeError(`Unsupported critical sigil effect: ${SIGIL_BY_ID[id]?.name ?? id} (${proc.effect}).`);
}

function commonSigilEvent(
  id: number,
  sourceSkill: string
): Pick<SimulationEventBase, 'name' | 'skillName' | 'source' | 'sourceId' | 'actorType' | 'ownerActorType'> & {
  readonly triggeredBy: string;
} {
  return {
    name: `Sigil of ${SIGIL_BY_ID[id]?.name ?? id}`,
    skillName: `Sigil of ${SIGIL_BY_ID[id]?.name ?? id}`,
    source: 'Sigil',
    sourceId: `sigil.${id}`,
    actorType: 'effect',
    ownerActorType: 'player',
    triggeredBy: sourceSkill
  };
}

/** Builds the canonical strike packet shared by scheduler and resolver sigils. */
export function createSigilStrikeEvent(id: number, proc: Gw2SigilProc, sourceSkill: string): SimulationEventBase {
  return {
    ...commonSigilEvent(id, sourceSkill),
    type: 'damage',
    at: 0,
    coefficient: proc.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    weaponStrength: proc.weaponStrength,
    skillWeapon: 'Unequipped',
    canCrit: proc.canCrit === true,
    // Preserve projectile identity so equipment missiles participate in projectile hit reactions.
    projectile: proc.projectile === true,
    canTriggerCriticalSigils: proc.canCrit === true,
    canTriggerCriticalTraits: proc.canCrit === true
  };
}

/** Builds the canonical condition packet shared by scheduler and resolver sigils. */
export function createSigilConditionEvent(id: number, proc: Gw2SigilProc, sourceSkill: string): SimulationEventBase {
  return {
    ...commonSigilEvent(id, sourceSkill),
    type: 'condition',
    at: 0,
    name: `Sigil of ${SIGIL_BY_ID[id]?.name ?? id} — ${proc.condition || ''}`,
    condition: proc.condition,
    duration: proc.duration,
    stacks: proc.stacks
  };
}
