import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild,
} from "./build.js";
import { mesmerCatalog } from "./catalog.js";
import { mesmerCoreModule } from "./core/module.js";
import { chronomancerModule } from "./specializations/chronomancer/module.js";
import { mirageModule } from "./specializations/mirage/module.js";
import { troubadourModule } from "./specializations/troubadour/module.js";
import { virtuosoModule } from "./specializations/virtuoso/module.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type {
  MesmerRuntimeState,
  MesmerSchedulerContext,
} from "./types.js";

function projectMesmerSimulationEndState({
  schedulerContext,
  schedulerState,
}: {
  readonly schedulerContext: MesmerSchedulerContext;
  readonly schedulerState: MesmerSchedulerContext["state"];
}): SchedulerRecord {
  const includeRechargeRemaining = [...schedulerState.ammo.values()].some(
    (value) => Object.hasOwn(value, "nextRechargeRemaining"),
  );
  const runtimeSkillIds = new Set(
    schedulerContext.catalog.skills.map((skill) => String(skill.id)),
  );
  const ammo = Object.fromEntries(
    mesmerCatalog.skills.flatMap((skill) => {
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
            ...(includeRechargeRemaining
              ? { nextRechargeRemaining: null }
              : {}),
          };
      return [[skill.name, value] as const];
    }),
  );
  return { ammo };
}

export const mesmerProfession = defineProfessionFamily<MesmerRuntimeState>({
  id: "mesmer",
  name: "Mesmer",
  catalog: mesmerCatalog,
  build: {
    createBuildDefaults: createMesmerBuildDefaults,
    migrateBuild: migrateMesmerBuild,
    validateBuild: validateMesmerBuild,
  },
  core: mesmerCoreModule,
  specializations: {
    Chronomancer: chronomancerModule,
    Mirage: mirageModule,
    Virtuoso: virtuosoModule,
    Troubadour: troubadourModule,
  },
  simulation: Object.freeze({
    projectEndState: projectMesmerSimulationEndState,
  }) as SchedulerRecord,
});

export default mesmerProfession;
