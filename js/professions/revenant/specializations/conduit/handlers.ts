import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import type { SkillHandlerPhase } from "../../../../platform/engine/types.js";
import type { RevenantCastContext } from "../../types.js";
import { revenantConduitSkillHandlers } from "./conduit.js";

const handlers = Object.freeze({
  // Combat skills use replaceSkill: Conduit owns full damage/condition logic in beforeEffects, catalog contributes nothing
  "revenant.beguiling-haze": replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers[
      "revenant.beguiling-haze"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.gladiators-defense": replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers[
      "revenant.gladiators-defense"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.hex-eater-vortex": replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers[
      "revenant.hex-eater-vortex"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.twin-moon-sweep": replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers[
      "revenant.twin-moon-sweep"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.release-potential": replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers[
      "revenant.release-potential"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  // Cosmic Wisdom augments so base energy cost fires first before the afterEffects handler
  "revenant.cosmic-wisdom": augmentSkill<RevenantCastContext>({
    afterEffects: revenantConduitSkillHandlers[
      "revenant.cosmic-wisdom"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
});

export const conduitSkillHandlers = new Map(Object.entries(handlers));
