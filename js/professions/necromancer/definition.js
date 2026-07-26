import { defineProfession } from "../../platform/engine/profession.js";
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild,
  validateNecromancerBuild,
} from "./build.js";
import {
  necromancerAttributeRules,
  necromancerCastModifiers,
} from "./attribute-rules.js";
import { necromancerCatalog } from "./catalog.js";
import {
  necromancerCastRules,
  necromancerSchedulerHooks,
} from "./mechanics/contract.js";
import {
  necromancerResolverEventHandlers,
  necromancerResolverEventReactions,
} from "./resolver/event-handlers.js";
import {
  createNecromancerState,
  snapshotNecromancerState,
} from "./state.js";
import { necromancerUi } from "./ui.js";

export const necromancerProfession = defineProfession({
  id: "necromancer",
  name: "Necromancer",
  catalog: necromancerCatalog,
  build: {
    createBuildDefaults: createNecromancerBuildDefaults,
    migrateBuild: migrateNecromancerBuild,
    validateBuild: validateNecromancerBuild,
  },
  resources: {
    createProfessionState: createNecromancerState,
    createResolverState: config => createNecromancerState(config),
  },
  attributeRules: necromancerAttributeRules,
  castRules: {
    ...necromancerCastRules,
    ...necromancerCastModifiers,
  },
  schedulerHooks: {
    ...necromancerSchedulerHooks,
    snapshot: context =>
      snapshotNecromancerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: necromancerResolverEventHandlers,
    eventReactions: necromancerResolverEventReactions,
  },
  ui: necromancerUi,
});

export default necromancerProfession;
