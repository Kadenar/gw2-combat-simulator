import { engineerCoreSkillHandlers } from "./core/handlers.js";
import { amalgamSkillHandlers } from "./specializations/amalgam/handlers.js";
import { holosmithSkillHandlers } from "./specializations/holosmith/handlers.js";
import { mechanistSkillHandlers } from "./specializations/mechanist/handlers.js";
import { scrapperSkillHandlers } from "./specializations/scrapper/handlers.js";

export const engineerSkillHandlers = Object.freeze({
  ...engineerCoreSkillHandlers,
  ...scrapperSkillHandlers,
  ...holosmithSkillHandlers,
  ...mechanistSkillHandlers,
  ...amalgamSkillHandlers,
});
