import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { MesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/types.js';
import type {
  MesmerPhantasmEffectController,
  MesmerPhantasmExecution
} from '#gw2/professions/mesmer/core/mechanics/illusions/phantasms.js';
import type { MesmerQueueResources } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerResourceDefinition } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

interface DirectSkillResourceOptions {
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
}

/** Queue declared add/fill grants without constructing phantasms; report whether a direct grant was handled. */
export function scheduleDirectSkillResources(
  { resourceDefinition, activePrimaryWeapon, queueResources }: DirectSkillResourceOptions,
  skill: MesmerSkill,
  at: number,
  castStart: number,
  delivery: EffectDelivery = {}
): boolean {
  if (skill.resource?.mode === 'fill') {
    // Resource tasks run after the completion task; a synthetic delay would hide the gain from the next cast.
    queueResources(
      at,
      resourceDefinition.maximum,
      skill.weapon || activePrimaryWeapon(),
      skill.name,
      {
        kind: 'skill',
        sourceSkillId: skill.id
      },
      delivery
    );
    return true;
  }

  if (skill.resource?.mode === 'add') {
    const resourceAt =
      skill.resource.timingAnchor === 'castStart'
        ? castStart + (skill.resource.atMs || 0) / 1000
        : at + (skill.resource.atMs || 0) / 1000;
    queueResources(
      resourceAt,
      skill.resource.count || 0,
      skill.weapon || activePrimaryWeapon(),
      skill.name,
      {
        kind: 'skill',
        sourceSkillId: skill.id
      },
      delivery
    );
    return true;
  }

  return false;
}

/** Keep simultaneous phantasm conversions atomic, including specialization-specific conversion instants. */
export function schedulePhantasmConversions(
  phantasmExecutions: readonly MesmerPhantasmExecution[],
  queueConversion: MesmerPhantasmEffectController['queueConversion']
): void {
  const conversionGroups = new Map<number, MesmerPhantasmExecution[]>();
  for (const phantasm of phantasmExecutions) {
    const conversionAt = phantasm.resourceAtOverride ?? phantasm.conversionAt;
    const group = conversionGroups.get(conversionAt) || [];
    group.push(phantasm);
    conversionGroups.set(conversionAt, group);
  }

  for (const group of conversionGroups.values()) {
    queueConversion(group[0], group.length);
  }
}
