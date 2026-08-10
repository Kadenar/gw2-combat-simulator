import { necromancerBlightSkillHandlers } from "./blight.js";
import { darkBarrage } from "./dark-barrage.js";
import { darkBarrageHandlerMode } from "./traits.js";
import {
  replaceSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";

export const harbingerSkillHandlers = new Map([
  [
    "necromancer.elixir",
    replaceSkillHandler(necromancerBlightSkillHandlers["necromancer.elixir"]),
  ],
  [
    "necromancer.blight-skill",
    replaceSkillHandler(
      necromancerBlightSkillHandlers["necromancer.blight-skill"],
    ),
  ],
  [
    "necromancer.dark-barrage",
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: darkBarrageHandlerMode,
      beforeEffects: darkBarrage,
    }),
  ],
]);
