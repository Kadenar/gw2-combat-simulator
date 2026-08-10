import {
  defineNativeModule,
  onConditionApplied,
  onResolvedBlind,
  onResolvedControl,
  onResolvedDamage,
} from "../../../platform/gw2/native-profession.js";
import { createNecromancerModuleData } from "../catalog-data.js";
import {
  necromancerCoreAttributeRules,
  necromancerCoreCastRules,
  necromancerSchedulerHooks,
  snapshotNecromancerState,
} from "./rules.js";
import {
  necromancerCoreResolverEventHandlers,
  necromancerCoreResolverEventReactions,
} from "./resolver.js";
import {
  createNecromancerCoreState,
  projectNecromancerEndState,
} from "./state.js";
import { bindNecromancerCoreUi } from "./ui.js";
import {
  NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  NECROMANCER_CORE_EXTRA_SKILLS,
} from "./skills.js";
import { necromancerCoreSkillHandlers } from "./handlers.js";
import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";
import type { NecromancerSchedulerContext } from "../types.js";

export const necromancerCoreModule = defineNativeModule({
  id: "Core",
  data: createNecromancerModuleData("Core", {
    skillMechanics: NECROMANCER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: NECROMANCER_CORE_EXTRA_SKILLS,
    handlers: necromancerCoreSkillHandlers,
    autoattackChains: {
      additional: [[ID.ENERVATION_BLADE, ID.ENERVATION_ECHO]],
    },
  }),
  state: {
    scheduler: createNecromancerCoreState,
    resolver: createNecromancerCoreState,
    project: projectNecromancerEndState,
  },
  mechanics: {
    modifiers: necromancerCoreAttributeRules,
    castRules: necromancerCoreCastRules,
    schedulerHooks: {
      ...necromancerSchedulerHooks,
      snapshot: (context: NecromancerSchedulerContext) =>
        snapshotNecromancerState(context.state.profession),
    },
    resolverHooks: { eventHandlers: necromancerCoreResolverEventHandlers },
    reactions: [
      onResolvedDamage({
        id: "necromancer.core.damage",
        handler: necromancerCoreResolverEventReactions.damage,
      }),
      onResolvedBlind({
        id: "necromancer.core.blind",
        handler: necromancerCoreResolverEventReactions.blind,
      }),
      onResolvedControl({
        id: "necromancer.core.control",
        handler: necromancerCoreResolverEventReactions.control,
      }),
      onConditionApplied({
        id: "necromancer.core.condition",
        handler: necromancerCoreResolverEventReactions.condition,
      }),
    ],
  },
  presentation: bindNecromancerCoreUi,
});
