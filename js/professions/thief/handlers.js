import { thiefCoreSkillHandlers } from "./core/handlers.js";
import { antiquarySkillHandlers } from "./specializations/antiquary/handlers.js";
import { deadeyeSkillHandlers } from "./specializations/deadeye/handlers.js";
import { specterSkillHandlers } from "./specializations/specter/handlers.js";

/**
 * Application catalog facade. Runtime ownership remains in each module.
 */
export const thiefSkillHandlers = Object.freeze({
  ...thiefCoreSkillHandlers,
  ...deadeyeSkillHandlers,
  ...specterSkillHandlers,
  ...antiquarySkillHandlers,
});
