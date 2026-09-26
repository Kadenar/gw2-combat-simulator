import { splitStrikeHits } from '#gw2/platform/simulation/procedural-emission.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/**
 * Trait and autonomous packets retain their owning skill; the runtime defers future boons so their duration samples
 * at application. A strike's `interval` spaces its equally divided hits, and `maximumDuration` caps a scaled buff.
 */
export function emitEngineerEvent(
  runtime: EngineerRuntime,
  type: string,
  fields: Pick<SimulationEventBase, 'at'> & Partial<SimulationEventBase>,
  skill?: EngineerSkill
): void {
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
    for (const packet of splitStrikeHits(
      { ...event, coefficient: Number(event.coefficient) },
      Number(event.interval ?? 0)
    ))
      runtime.emitProcedural(packet);
    return;
  }

  runtime.emitProcedural(event, {
    ...(type === 'buff' && event.maximumDuration != null ? { maximumDuration: Number(event.maximumDuration) } : {})
  });
}
