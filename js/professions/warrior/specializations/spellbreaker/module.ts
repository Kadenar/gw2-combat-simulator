import {
  defineNativeModule,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createWarriorModuleData } from "../../catalog-data.js";
import { SPELLBREAKER_SKILL_MECHANICS } from "./skills.js";
import { spellbreakerSkillHandlers } from "./handlers.js";
import {
  reactToSpellbreakerControl,
  reactToSpellbreakerDamage,
} from "./resolver.js";
import {
  spellbreakerAttributeRules,
  spellbreakerSchedulerHooks,
} from "./rules.js";
import { spellbreakerState } from "./state.js";
import { spellbreakerUi } from "./ui.js";
import { SPELLBREAKER_BALANCE_PROFILES } from "./profiles.js";

export const spellbreakerModule = defineNativeModule({
  id: "Spellbreaker",
  data: createWarriorModuleData("Spellbreaker", {
    skillMechanics: SPELLBREAKER_SKILL_MECHANICS,
    balanceProfiles: SPELLBREAKER_BALANCE_PROFILES,
    handlers: spellbreakerSkillHandlers,
  }),
  state: {
    scheduler: spellbreakerState.create,
    resolver: spellbreakerState.create,
  },
  mechanics: {
    modifiers: spellbreakerAttributeRules,
    schedulerHooks: spellbreakerSchedulerHooks,
    reactions: [
      onResolvedControl({
        id: "warrior.spellbreaker-control",
        handler: reactToSpellbreakerControl,
      }),
      onResolvedDamage({
        id: "warrior.spellbreaker-damage",
        handler: reactToSpellbreakerDamage,
      }),
    ],
  },
  presentation: spellbreakerUi,
});
