import { defineProfession } from "../../platform/engine/profession.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "./build.js";
import {
  guardianCatalog,
  GUARDIAN_SKILL_IDS,
} from "./catalog.js";

function createGuardianState() {
  return {
    justiceArmed: false,
    justiceBurns: 0,
  };
}

export const guardianProfession = defineProfession({
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
  },
  schedulerHooks: {
    snapshot: context => structuredClone(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: {
      "guardian.justice-activated": context => {
        context.state.profession.justiceArmed = true;
      },
    },
    eventReactions: {
      damage(context, event, { hitContext, applyCondition } = {}) {
        if (
          !context.state.profession.justiceArmed
          || !hitContext
          || typeof applyCondition !== "function"
        ) return;
        context.state.profession.justiceArmed = false;
        context.state.profession.justiceBurns += 1;
        applyCondition(context, {
          type: "condition",
          at: event.at,
          source: "guardian",
          sourceId: "guardian.justice-burning",
          skillId: GUARDIAN_SKILL_IDS.JUSTICE,
          skillName: "Virtue of Justice",
          condition: "Burning",
          stacks: 1,
          duration: 2,
        });
      },
    },
  },
  ui: {
    paletteGroups: () => [{
      id: "guardian-virtues",
      label: "Virtues",
      skillIds: [GUARDIAN_SKILL_IDS.JUSTICE],
      color: "#2f7eb8",
    }],
    resourceViews: () => [],
  },
});

export default guardianProfession;
