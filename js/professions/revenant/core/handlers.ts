import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import type { SkillHandlerPhase } from "../../../platform/engine/types.js";
import type { RevenantCastContext } from "../types.js";
import {
  gainAncientEchoEnergy,
  revenantCoreSkillHandlers as rawCoreHandlers,
} from "./actions.js";
import { activateEnchantedDaggers } from "./assassin.js";
import {
  augmentAfter,
  handlerPhase,
  replaceAfter,
  replaceBefore,
} from "./handler-strategies.js";
import { revenantSpearSkillHandlers } from "./spear.js";
import { revenantUpkeepSkillHandlers } from "./upkeep.js";

const handlers = Object.freeze({
  "revenant.weapon-swap": replaceAfter(rawCoreHandlers["revenant.weapon-swap"]),
  "revenant.legend-swap": replaceAfter(rawCoreHandlers["revenant.legend-swap"]),
  "revenant.dodge": replaceSkillHandler<RevenantCastContext>(
    handlerPhase(rawCoreHandlers["revenant.dodge"]),
  ),
  "revenant.enchanted-daggers": replaceAfter(activateEnchantedDaggers),
  "revenant.upkeep": replaceAfter(
    revenantUpkeepSkillHandlers["revenant.upkeep"],
  ),
  "revenant.upkeep-release": replaceAfter(
    revenantUpkeepSkillHandlers["revenant.upkeep-release"],
  ),
  "revenant.inspiring-reinforcement": replaceBefore(
    revenantUpkeepSkillHandlers["revenant.inspiring-reinforcement"],
  ),
  "revenant.spear-recharge": augmentSkillHandler<RevenantCastContext>(
    null as unknown as SkillHandlerPhase<RevenantCastContext>,
    {
      afterEffect: (context, skill, event) =>
        revenantSpearSkillHandlers["revenant.spear-recharge"](
          context,
          skill,
          event,
        ),
    },
  ),
  "revenant.abyssal-raze": replaceBefore(
    revenantSpearSkillHandlers["revenant.abyssal-raze"],
  ),
  "revenant.ancient-echo": augmentAfter(gainAncientEchoEnergy),
});

export const revenantCoreSkillHandlers = new Map(Object.entries(handlers));
