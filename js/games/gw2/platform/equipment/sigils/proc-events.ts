import { ACTOR } from '#gw2/platform/constants.js';
import type { PacketEmission, ProfileEmission } from '#gw2/platform/effects/emission.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import { SIGIL_BY_ID } from '#gw2/platform/equipment/sigils/data.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/sigils/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';

/** Selects the eventual damage payload; live callers still own eligibility, cooldowns, and next-hit arming. */
export function createSigilDamagePayload(
  id: number,
  proc: Gw2SigilProc,
  sourceSkill: string
): readonly SimulationEventBase[] {
  const events: SimulationEventBase[] = [];

  if (proc.effect === 'strike' || proc.effect === 'strike-condition')
    events.push(createSigilStrikeEvent(id, proc, sourceSkill));

  if (
    proc.effect === 'condition' ||
    proc.effect === 'next-hit-condition' ||
    (proc.effect === 'strike-condition' && proc.condition)
  )
    events.push(createSigilConditionEvent(id, proc, sourceSkill));

  return events;
}

/** Critical boon procs retain yield lineage; every proc samples modifiers from its triggering hit. */
export function createCriticalSigilRequest(
  id: number,
  proc: Gw2SigilProc,
  event: Gw2ResolverEvent
): PacketEmission | ProfileEmission {
  const sourceSkill = event.skillName || '';

  if (proc.effect === 'boon')
    return {
      kind: 'profile',
      profile: { id: `sigil.${id}`, name: `Sigil of ${SIGIL_BY_ID[id].name}` },
      at: event.at,
      durationContext: event,
      attribution: commonSigilEvent(id, sourceSkill),
      effects: [
        {
          type: 'boon',
          boon: proc.boon,
          stacks: proc.stacks,
          duration: requireBalanceNumber(proc.duration, `sigil.${id} boon duration`)
        }
      ],
      transform: (packet) => ({ ...packet, name: `Sigil of ${SIGIL_BY_ID[id].name}` })
    };

  if (proc.effect === 'strike' || proc.effect === 'condition')
    return {
      kind: 'packet',
      durationContext: event,
      event: {
        ...(proc.effect === 'strike'
          ? createSigilStrikeEvent(id, proc, sourceSkill)
          : createSigilConditionEvent(id, proc, sourceSkill)),
        at: event.at
      }
    };

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
    actorType: ACTOR.EFFECT,
    ownerActorType: ACTOR.PLAYER,
    triggeredBy: sourceSkill
  };
}

/** Builds the canonical strike packet shared by scheduler and resolver sigils. */
function createSigilStrikeEvent(id: number, proc: Gw2SigilProc, sourceSkill: string): SimulationEventBase {
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
    name: `Sigil of ${SIGIL_BY_ID[id]?.name ?? id} - ${proc.condition || ''}`,
    condition: proc.condition,
    duration: proc.duration,
    stacks: proc.stacks
  };
}
