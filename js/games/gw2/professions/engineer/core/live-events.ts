import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Trait and autonomous packets retain their owning skill while boons sample duration at application time. */
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
  if (type === 'buff') {
    if (event.at > runtime.time) {
      runtime.schedule('engineer.buff', event.at, event);
      return;
    }

    const kind = String(event.kind ?? '');
    const duration =
      isStandardBoon(kind) && !event.fixedDuration
        ? gw2ResolverBoonDuration(runtime, event as Gw2ResolverEvent, kind, Number(event.duration))
        : Number(event.duration);
    runtime.emit({ ...event, duration: Math.min(duration, Number(event.maximumDuration ?? Infinity)) });
  } else if (type === 'damage') {
    const hits = Math.max(1, Math.trunc(Number(event.hits ?? 1)));
    for (let index = 1; index <= hits; index++)
      runtime.emit({
        ...event,
        at: event.at + (index - 1) * Number(event.interval ?? 0),
        coefficient: Number(event.coefficient) / hits,
        hits: 1,
        hitIndex: event.hitIndex ?? index,
        totalHits: event.totalHits ?? hits
      });
  } else runtime.emit(event);
}
