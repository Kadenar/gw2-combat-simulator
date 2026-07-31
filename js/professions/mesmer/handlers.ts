import { mesmerCoreSkillHandlers } from "./core/handlers.js";
import { chronomancerSkillHandlers } from "./specializations/chronomancer/handlers.js";
import { mirageSkillHandlers } from "./specializations/mirage/handlers.js";
import { troubadourSkillHandlers } from "./specializations/troubadour/handlers.js";
import { virtuosoSkillHandlers } from "./specializations/virtuoso/handlers.js";

export const mesmerSkillHandlers = Object.freeze({
  ...mesmerCoreSkillHandlers,
  ...chronomancerSkillHandlers,
  ...mirageSkillHandlers,
  ...virtuosoSkillHandlers,
  ...troubadourSkillHandlers,
});
