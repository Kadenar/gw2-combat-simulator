import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "./build.js";
import {
  guardianAttributeRules,
  guardianCastModifiers,
} from "./attribute-rules.js";
import { guardianCatalog } from "./catalog.js";
import { guardianCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import {
  guardianCastRules,
  guardianSchedulerHooks,
} from "./mechanics/contract.js";
import {
  guardianResolverEventHandlers,
  guardianResolverEventReactions,
} from "./resolver.js";
import { dragonhunterModule } from "./specializations/dragonhunter/module.js";
import { firebrandModule } from "./specializations/firebrand/module.js";
import { luminaryModule } from "./specializations/luminary/module.js";
import { willbenderModule } from "./specializations/willbender/module.js";
import {
  createGuardianResolverState,
  createGuardianState,
  projectGuardianEndState,
  snapshotGuardianState,
} from "./state.js";
import { createGuardianFamilyUi } from "./ui.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type { GuardianSchedulerContext } from "./types.js";

const guardianUi = createGuardianFamilyUi(guardianCoreModule.ui || {}, {
  Dragonhunter: dragonhunterModule.ui || {},
  Firebrand: firebrandModule.ui || {},
  Willbender: willbenderModule.ui || {},
  Luminary: luminaryModule.ui || {},
});

export const guardianProfession = defineProfessionFamily<SchedulerRecord>({
  id: "guardian",
  name: "Guardian",
  catalog: guardianCatalog,
  build: {
    createBuildDefaults: createGuardianBuildDefaults,
    migrateBuild: migrateGuardianBuild,
    validateBuild: validateGuardianBuild,
  },
  resources: {
    createProfessionState: createGuardianState,
    createResolverState: createGuardianResolverState,
    projectEndState: projectGuardianEndState,
  },
  attributeRules: guardianAttributeRules,
  castRules: {
    ...guardianCastRules,
    ...guardianCastModifiers,
  },
  schedulerHooks: {
    ...guardianSchedulerHooks,
    snapshot: (context: GuardianSchedulerContext) =>
      snapshotGuardianState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: guardianResolverEventHandlers,
    eventReactions: guardianResolverEventReactions,
  },
  core: guardianCoreModule,
  specializations: {
    Dragonhunter: dragonhunterModule,
    Firebrand: firebrandModule,
    Willbender: willbenderModule,
    Luminary: luminaryModule,
  },
  ui: guardianUi,
});

export default guardianProfession;
