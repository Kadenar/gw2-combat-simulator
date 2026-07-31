import { revenantCoreSkillHandlers } from "./core/handlers.js";
import { conduitSkillHandlers } from "./specializations/conduit/handlers.js";
import { heraldSkillHandlers } from "./specializations/herald/handlers.js";
import { renegadeSkillHandlers } from "./specializations/renegade/handlers.js";
import { vindicatorSkillHandlers } from "./specializations/vindicator/handlers.js";

/** Complete application catalog handler facade. */
export const revenantSkillHandlers = Object.freeze(
  Object.fromEntries([
    ...revenantCoreSkillHandlers,
    ...heraldSkillHandlers,
    ...renegadeSkillHandlers,
    ...vindicatorSkillHandlers,
    ...conduitSkillHandlers,
  ]),
);
