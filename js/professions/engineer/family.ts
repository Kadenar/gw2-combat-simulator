import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  engineerAttributeRules,
  engineerCastModifiers,
} from "./attribute-rules.js";
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild,
} from "./build.js";
import { engineerCatalog } from "./catalog.js";
import { engineerCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import {
  engineerCastRules,
  engineerSchedulerHooks,
} from "./mechanics/contract.js";
import {
  engineerResolverEventHandlers,
  engineerResolverEventReactions,
} from "./resolver.js";
import { amalgamModule } from "./specializations/amalgam/module.js";
import { holosmithModule } from "./specializations/holosmith/module.js";
import { mechanistModule } from "./specializations/mechanist/module.js";
import { scrapperModule } from "./specializations/scrapper/module.js";
import {
  createEngineerState,
  projectEngineerEndState,
  snapshotEngineerState,
} from "./state.js";
import { createEngineerFamilyUi } from "./ui.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type { EngineerSchedulerContext } from "./types.js";

const engineerUi = createEngineerFamilyUi(
  engineerCoreModule.ui || {},
  {
    Scrapper: scrapperModule.ui || {},
    Holosmith: holosmithModule.ui || {},
    Mechanist: mechanistModule.ui || {},
    Amalgam: amalgamModule.ui || {},
  },
);

export const engineerProfession =
  defineProfessionFamily<SchedulerRecord>({
    id: "engineer",
    name: "Engineer",
    catalog: engineerCatalog,
    build: {
      createBuildDefaults: createEngineerBuildDefaults,
      migrateBuild: migrateEngineerBuild,
      validateBuild: validateEngineerBuild,
    },
    // Family/application compatibility only. Simulation resolves Core plus
    // exactly one elite module through resolveRuntime().
    resources: {
      createProfessionState: createEngineerState,
      createResolverState: createEngineerState,
      projectEndState: projectEngineerEndState,
    },
    attributeRules: engineerAttributeRules,
    castRules: {
      ...engineerCastRules,
      ...engineerCastModifiers,
    },
    schedulerHooks: {
      ...engineerSchedulerHooks,
      snapshot: (context: EngineerSchedulerContext) =>
        snapshotEngineerState(context.state.profession),
    },
    resolverHooks: {
      eventHandlers: engineerResolverEventHandlers,
      eventReactions: engineerResolverEventReactions,
    },
    core: engineerCoreModule,
    specializations: {
      Scrapper: scrapperModule,
      Holosmith: holosmithModule,
      Mechanist: mechanistModule,
      Amalgam: amalgamModule,
    },
    ui: engineerUi,
  });

export default engineerProfession;
