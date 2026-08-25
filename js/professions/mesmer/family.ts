import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { defineNativeProfession } from '../../platform/gw2/authoring/profession.js';
import { activePatchPreview } from '../../patches/active-preview.js';
import { createMesmerBuildDefaults, migrateMesmerBuild, validateMesmerBuild } from './build.js';
import { MESMER_NATIVE_CATALOG_OPTIONS } from './catalog-data.js';
import { mesmerNativeModules } from './modules.js';
import type { SchedulerRecord } from '../../platform/engine/types.js';
import type { MesmerSchedulerContext } from './types.js';

const applicationCatalog = assembleNativeApplicationCatalog(mesmerNativeModules, MESMER_NATIVE_CATALOG_OPTIONS);

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
  patchPreview: activePatchPreview,
  simulation: Object.freeze({
    projectEndState: projectMesmerSimulationEndState
  }) as SchedulerRecord
});

export default mesmerProfession;
