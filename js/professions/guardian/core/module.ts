import {
  defineNativeModule,
  onBuffApplied,
  onResolvedDamage,
} from "../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../catalog-data.js";
import {
  guardianCoreEventHandlers,
  guardianCoreEventReactions,
  guardianCoreSkillHandlers,
} from "./handlers.js";
import {
  guardianCoreAttributeRules,
  guardianCoreCastRules,
  guardianCoreSchedulerHooks,
} from "./rules.js";
import {
  GUARDIAN_CORE_EXTRA_SKILLS,
  GUARDIAN_CORE_SKILL_MECHANICS,
} from "./skills.js";
import {
  createGuardianCoreState,
  projectGuardianEndState,
  snapshotGuardianState,
} from "./state.js";
import { bindGuardianCoreUi } from "./ui.js";
import type { GuardianSchedulerContext } from "../types.js";

export const guardianCoreModule = defineNativeModule({
  id: "Core",
  data: createGuardianModuleData("Core", {
    skillMechanics: GUARDIAN_CORE_SKILL_MECHANICS,
    extraSkills: GUARDIAN_CORE_EXTRA_SKILLS,
    handlers: guardianCoreSkillHandlers,
  }),
  state: {
    scheduler: createGuardianCoreState,
    resolver: createGuardianCoreState,
    project: projectGuardianEndState,
  },
  mechanics: {
    modifiers: guardianCoreAttributeRules,
    castRules: guardianCoreCastRules,
    schedulerHooks: {
      ...guardianCoreSchedulerHooks,
      snapshot: (context: GuardianSchedulerContext) =>
        snapshotGuardianState(context.state.profession),
    },
    reactions: [
      ...guardianCoreEventReactions.damage.map(onResolvedDamage),
      ...guardianCoreEventReactions.buff.map(onBuffApplied),
    ],
    resolverHooks: {
      eventHandlers: guardianCoreEventHandlers,
    },
  },
  presentation: bindGuardianCoreUi,
});
