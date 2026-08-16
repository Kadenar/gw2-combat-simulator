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
    // replaceSkillHandler: elixirs and blight skills are fully Harbinger-specific; the base necromancer handler is not run.
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
    // AUGMENT by default so the base skill still fires; resolveMode switches to REPLACE when Doom Approaches is equipped,
    // because the trait replaces the attack entirely with the 8-hit barrage (darkBarrage returns true, suppressing the base hit).
    "necromancer.dark-barrage",
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: darkBarrageHandlerMode,
      beforeEffects: darkBarrage,
    }),
  ],
]);
