import { necromancerCoreSkillHandlers } from "./core/handlers.js";
import { harbingerSkillHandlers } from "./specializations/harbinger/handlers.js";
import { reaperSkillHandlers } from "./specializations/reaper/handlers.js";
import { ritualistSkillHandlers } from "./specializations/ritualist/handlers.js";
import { scourgeSkillHandlers } from "./specializations/scourge/handlers.js";

/**
 * Application-level catalog facade. Ownership remains with the Core and
 * specialization modules; this table only exposes their union to the canonical
 * catalog builder.
 */
export const necromancerSkillHandlers = Object.freeze(
  Object.fromEntries([
    ...necromancerCoreSkillHandlers,
    ...reaperSkillHandlers,
    ...scourgeSkillHandlers,
    ...harbingerSkillHandlers,
    ...ritualistSkillHandlers,
  ]),
);
