import { MESMER_SKILL_IDS as ID } from '../data/ids.js';
import type {
  MesmerActivePrimaryWeapon,
  MesmerCurrentResource,
  MesmerQueueResources,
  MesmerResourceDefinition,
  MesmerSkill
} from '../types.js';
import type { MesmerPhantasmEffectController, MesmerPhantasmExecution } from './phantasms.js';

export interface MesmerIllusionResourceController {
  cloneAtMaximum(skill: MesmerSkill): boolean;
  schedule(
    skill: MesmerSkill,
    at: number,
    castStart: number,
    cloneAtMaximum: boolean,
    phantasms: readonly MesmerPhantasmExecution[]
  ): void;
}

interface IllusionResourceControllerOptions {
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly epsilon: number;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly currentResource: MesmerCurrentResource;
  readonly queueResources: MesmerQueueResources;
  readonly phantasms: MesmerPhantasmEffectController;
}

export function createIllusionResourceController({
  resourceDefinition,
  epsilon,
  activePrimaryWeapon,
  currentResource,
  queueResources,
  phantasms
}: IllusionResourceControllerOptions): MesmerIllusionResourceController {
  const cloneAtMaximum = (skill: MesmerSkill): boolean =>
    skill.id === ID.ETHER_CLONE &&
    resourceDefinition.singular === 'clone' &&
    currentResource() >= resourceDefinition.maximum;

  const schedule = (
    skill: MesmerSkill,
    at: number,
    castStart: number,
    atMaximum: boolean,
    phantasmExecutions: readonly MesmerPhantasmExecution[]
  ): void => {
    if (skill.resource?.mode === 'fill') {
      queueResources(at + epsilon, resourceDefinition.maximum, skill.weapon || activePrimaryWeapon(), skill.name, {
        kind: 'skill',
        sourceSkillId: skill.id
      });
      return;
    }
    if (skill.resource?.mode === 'add' && !atMaximum) {
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
      const conversionAt = phantasm.virtuosoBladeAt ?? phantasm.conversionAt;
      const group = conversionGroups.get(conversionAt) || [];
      group.push(phantasm);
      conversionGroups.set(conversionAt, group);
    }
    for (const group of conversionGroups.values()) {
      phantasms.queueConversion(group[0], group.length);
    }
  };

  return { cloneAtMaximum, schedule };
}
