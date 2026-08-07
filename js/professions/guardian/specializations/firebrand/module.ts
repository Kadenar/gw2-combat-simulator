import {
  defineNativeModule,
  onResolvedDamage,
  skillAvailability,
} from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import {
  firebrandEventHandlers,
  firebrandEventReactions,
  firebrandSkillHandlers,
} from "./handlers.js";
import {
  firebrandAttributeRules,
  firebrandCastRules,
  firebrandSchedulerHooks,
} from "./rules.js";
import { FIREBRAND_SKILL_MECHANICS } from "./skills.js";
import { createFirebrandState } from "./state.js";
import { firebrandUi } from "./ui.js";

export const firebrandModule = defineNativeModule({
  id: "Firebrand",
  data: createGuardianModuleData("Firebrand", {
    skillMechanics: FIREBRAND_SKILL_MECHANICS,
    handlers: firebrandSkillHandlers,
  }),
  state: {
    scheduler: createFirebrandState,
    resolver: createFirebrandState,
  },
  mechanics: {
    modifiers: firebrandAttributeRules,
    availability: firebrandCastRules.availability.map(skillAvailability),
    castRules: { validateCast: firebrandCastRules.validateCast },
    schedulerHooks: firebrandSchedulerHooks,
    reactions: firebrandEventReactions.damage.map(onResolvedDamage),
    resolverHooks: {
      eventHandlers: firebrandEventHandlers,
      eventReactions: { buff: firebrandEventReactions.buff },
    },
  },
  presentation: firebrandUi,
});
