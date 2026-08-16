import { SKILL_HANDLER_MODES } from "../../../../platform/engine/skill-handlers.js";
import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import type {
  Skill,
  SkillHandlerPhase,
  SkillHandlerMode,
} from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";
import { revenantAssassinRenegadeSkillHandlers } from "./renegade.js";
import type { BandTogetherState } from "./renegade.js";

const bandTogether =
  revenantAssassinRenegadeSkillHandlers["revenant.band-together"];

function bandTogetherHandlerMode(
  context: RevenantCastContext,
  skill: Skill,
): SkillHandlerMode {
  // REPLACE suppresses catalog effects (enhanced Icerazor re-emits them); AUGMENT lets catalog through and handler observes/modifies
  return bandTogether.replacesEffects(context, skill)
    ? SKILL_HANDLER_MODES.REPLACE
    : SKILL_HANDLER_MODES.AUGMENT;
}

const handlers = Object.freeze({
  // Heroic Command / Orders from Above have no catalog damage effects; replaceSkill owns all emitted events in afterEffects
  "revenant.heroic-command": replaceSkill<RevenantCastContext>({
    afterEffects: revenantAssassinRenegadeSkillHandlers[
      "revenant.heroic-command"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  "revenant.orders-from-above": replaceSkill<RevenantCastContext>({
    afterEffects: revenantAssassinRenegadeSkillHandlers[
      "revenant.orders-from-above"
    ] as SkillHandlerPhase<RevenantCastContext>,
  }),
  // Band Together uses dynamic mode: enhanced Icerazor must replace catalog packets; normal summons augment them
  "revenant.band-together": augmentSkill<RevenantCastContext>({
    beforeEffects:
      bandTogether.beforeEffects as SkillHandlerPhase<RevenantCastContext>,
    resolveMode: bandTogetherHandlerMode,
    afterEffect: (context, skill, event, state) =>
      bandTogether.afterEffect(
        context,
        skill as RevenantSkill,
        event as RevenantSimulationEvent,
        state as BandTogetherState,
      ),
    afterEffects: (context, skill, state) =>
      bandTogether.afterEffects(
        context,
        skill as RevenantSkill,
        state as BandTogetherState,
      ),
  }),
});

export const renegadeSkillHandlers = new Map(Object.entries(handlers));
