import type {
  MesmerActivePrimaryWeapon,
  MesmerQueueResources,
  MesmerResourceDefinition,
  MesmerSkill
} from '../types.js';
import type { MesmerPhantasmEffectController, MesmerPhantasmExecution } from './phantasms.js';

export interface MesmerIllusionResourceController {
  schedule(skill: MesmerSkill, at: number, castStart: number, phantasms: readonly MesmerPhantasmExecution[]): void;
}

interface IllusionResourceControllerOptions {
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly epsilon: number;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
  readonly phantasms: MesmerPhantasmEffectController;
}

// Coordinate direct resource grants with phantasm-driven conversions through a
// single scheduler-facing controller.
export function createIllusionResourceController({
  resourceDefinition,
  epsilon,
  activePrimaryWeapon,
  queueResources,
  phantasms
}: IllusionResourceControllerOptions): MesmerIllusionResourceController {
  // Anchor explicit fill/add effects to their declared cast timing; otherwise
  // group simultaneous phantasms so their resource conversion stays atomic.
  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart: number,
    phantasmExecutions: readonly MesmerPhantasmExecution[]
  ): void => {
    if (skill.resource?.mode === 'fill') {
      queueResources(at + epsilon, resourceDefinition.maximum, skill.weapon || activePrimaryWeapon(), skill.name, {
        kind: 'skill',
        sourceSkillId: skill.id
      });
      return;
    }

    if (skill.resource?.mode === 'add') {
      const resourceAt =
        skill.resource.timingAnchor === 'castStart'
          ? castStart + Number(skill.resource.atMs || 0) / 1000
          : at + Number(skill.resource.atMs || 0) / 1000;
      queueResources(
        resourceAt + epsilon,
        Number(skill.resource.count || 0),
        skill.weapon || activePrimaryWeapon(),
        skill.name,
        { kind: 'skill', sourceSkillId: skill.id }
      );
      return;
    }

    const conversionGroups = new Map<number, MesmerPhantasmExecution[]>();
    for (const phantasm of phantasmExecutions) {
      const conversionAt = phantasm.resourceAtOverride ?? phantasm.conversionAt;
      const group = conversionGroups.get(conversionAt) || [];
      group.push(phantasm);
      conversionGroups.set(conversionAt, group);
    }

    for (const group of conversionGroups.values()) {
      phantasms.queueConversion(group[0], group.length);
    }
  };

  return { schedule };
}
