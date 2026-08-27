import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createMesmerBuildDefaults, migrateMesmerBuild, validateMesmerBuild } from './build.js';
import { MESMER_NATIVE_CATALOG_OPTIONS } from './catalog-data.js';
import { mesmerNativeModules } from './modules.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import type { MesmerSchedulerContext } from './types.js';
import { MESMER_SKILL_IDS as ID } from './data/ids.js';

const applicationCatalog = assembleNativeApplicationCatalog(mesmerNativeModules, MESMER_NATIVE_CATALOG_OPTIONS);

// Project clone, phantasm, and specialization state from scheduler events into a
// stable simulation-end snapshot for subsequent consumers.
function projectMesmerSimulationEndState({
  schedulerContext,
  schedulerState
}: {
  readonly schedulerContext: MesmerSchedulerContext;
  readonly schedulerState: MesmerSchedulerContext['state'];
}): SchedulerRecord {
  const includeRechargeRemaining = [...schedulerState.ammo.values()].some((value) =>
    Object.hasOwn(value, 'nextRechargeRemaining')
  );
  const runtimeSkillIds = new Set(schedulerContext.catalog.skills.map((skill) => String(skill.id)));
  const ammo = Object.fromEntries(
    applicationCatalog.skills.flatMap((skill) => {
      const maximum = schedulerContext.maximumAmmoFor(skill);
      if (!(maximum > 0)) return [];
      const existing = schedulerState.ammo.get(skill.id);
      if (!existing && runtimeSkillIds.has(String(skill.id))) return [];
      const value = existing
        ? structuredClone(existing)
        : {
            charges: maximum,
            maximum,
            rechargeDuration: schedulerContext.rechargeDurationFor(skill, 0),
            nextRechargeAt: null,
            ...(includeRechargeRemaining ? { nextRechargeRemaining: null } : {})
          };
      return [[skill.name, value] as const];
    })
  );
  return { ammo };
}

export const mesmerProfession = defineNativeProfession({
  id: 'mesmer',
  name: 'Mesmer',
  catalog: MESMER_NATIVE_CATALOG_OPTIONS,
  build: {
    createBuildDefaults: createMesmerBuildDefaults,
    migrateBuild: migrateMesmerBuild,
    validateBuild: validateMesmerBuild
  },
  modules: mesmerNativeModules,
  autoattackChains: {
    // Mesmer roots have deliberately different persistence contracts; each
    // override is evaluated against the pending root instead of the profession globally.
    overrides: [
      {
        id: 'mesmer.ether-bolt-preserves-weapon-skills',
        chainRootIds: [ID.ETHER_BOLT],
        when: ({ interruptingSkill }) => interruptingSkill.type === 'Weapon',
        decision: 'preserve'
      },
      {
        id: 'mesmer.imaginary-axes-preserves-axe',
        chainRootIds: [ID.LACERATING_CHOP],
        interruptingSkillIds: [ID.IMAGINARY_AXES],
        decision: 'preserve'
      },
      {
        id: 'mesmer.long-nonweapon-casts-reset',
        when: ({ interruptingSkill }) =>
          interruptingSkill.type !== 'Weapon' &&
          Number(interruptingSkill.quicknessCastTimeMs ?? interruptingSkill.castTimeMs ?? 0) > 400 &&
          interruptingSkill.rechargeAnchor !== 'castStart',
        decision: 'reset'
      }
    ]
  },
  patchPreview: activePatchPreview,
  simulation: Object.freeze({
    projectEndState: projectMesmerSimulationEndState
  }) as SchedulerRecord
});

export default mesmerProfession;
