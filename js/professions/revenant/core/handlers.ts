import {
  augmentSkill,
  replaceSkill,
} from "../../../platform/gw2/native-profession.js";
import type { SkillHandlerPhase } from "../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../types.js";
import {
  gainAncientEchoEnergy,
  revenantCoreSkillHandlers as rawCoreHandlers,
} from "./actions.js";
import { activateEnchantedDaggers } from "./assassin.js";
import { revenantSpearSkillHandlers } from "./spear.js";
import { revenantUpkeepSkillHandlers } from "./upkeep.js";

const handlers = Object.freeze({
  "revenant.weapon-swap": replaceSkill<RevenantCastContext>({
    afterEffects: rawCoreHandlers[
      "revenant.weapon-swap"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.legend-swap": replaceSkill<RevenantCastContext>({
    afterEffects: rawCoreHandlers[
      "revenant.legend-swap"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.dodge": replaceSkill<RevenantCastContext>({
    beforeEffects: rawCoreHandlers[
      "revenant.dodge"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.enchanted-daggers": replaceSkill<RevenantCastContext>({
    afterEffects:
      activateEnchantedDaggers as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.upkeep": replaceSkill<RevenantCastContext>({
    afterEffects: revenantUpkeepSkillHandlers[
      "revenant.upkeep"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.upkeep-release": replaceSkill<RevenantCastContext>({
    afterEffects: revenantUpkeepSkillHandlers[
      "revenant.upkeep-release"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.inspiring-reinforcement": replaceSkill<RevenantCastContext>({
    beforeEffects: revenantUpkeepSkillHandlers[
      "revenant.inspiring-reinforcement"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.spear-recharge": augmentSkill<RevenantCastContext>({
    afterEffect: (context, skill, event) =>
      revenantSpearSkillHandlers["revenant.spear-recharge"](
        context,
        skill as RevenantSkill,
        event as RevenantSimulationEvent,
      ),
  }),
  "revenant.abyssal-raze": replaceSkill<RevenantCastContext>({
    beforeEffects: revenantSpearSkillHandlers[
      "revenant.abyssal-raze"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.ancient-echo": augmentSkill<RevenantCastContext>({
    afterEffects: gainAncientEchoEnergy,
  }),
});

export const revenantCoreSkillHandlers = new Map(Object.entries(handlers));
