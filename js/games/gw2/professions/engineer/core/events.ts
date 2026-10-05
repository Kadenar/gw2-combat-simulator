import { splitStrikeHits } from '#gw2/platform/effects/procedural-packets.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/**
 * Trait and autonomous packets retain their owning skill; the runtime defers future boons so their duration samples
 * at application. A strike's `interval` spaces its equally divided hits, and `maximumDuration` caps a scaled buff.
 */
export function buildEngineerPackets(
  type: string,
  fields: Pick<SimulationEventBase, 'at'> & Partial<SimulationEventBase>,
  skill?: EngineerSkill
): SimulationEventBase[] {
  const event: SimulationEventBase = {
    source: 'engineer',
    sourceId: skill?.id ?? fields.skillId ?? 'engineer',
    actorType: 'player',
    skillId: skill?.id,
    skillName: skill?.name,
    name: skill?.name,
    ...(type === 'damage' ? { skillWeapon: skill?.type === 'Weapon' ? skill.weapon : 'Unequipped' } : {}),
    ...fields,
    type
  };
  if (type === 'damage') {
    return splitStrikeHits({ ...event, coefficient: Number(event.coefficient) }, Number(event.interval ?? 0));
  }

  return [event];
}
