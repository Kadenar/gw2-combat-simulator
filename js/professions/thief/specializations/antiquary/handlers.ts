import {
  augmentSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { emitStealTraitEffects } from "../../core/steal.js";
import { hasThiefTrait } from "../../core/state.js";
import { gainThiefInitiative } from "../../core/shared.js";
import {
  completeForgedSurfer,
  completeSkrittScuffle,
  consumeArtifact,
  handleForgedSurfer,
  handleSkrittScuffle,
  peekDoubleEdgeOutcome,
  pilferArtifacts,
  reshuffleArtifacts,
  resolveDoubleEdge,
} from "./artifacts.js";
import {
  advanceAntiquaryResources,
  spendAntiquaryResources,
} from "./resources.js";
import type { SkillHandlerPhase } from "../../../../platform/engine/types.js";
import type { ThiefCastContext } from "../../types.js";

function augmentAfter(handler: SkillHandlerPhase<ThiefCastContext>) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

function completeSkrittSwipe(context: ThiefCastContext): void {
  const at = context.effectiveEnd;
  pilferArtifacts(context, at, "pilfer", "swipe");
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(context, 2, at, "kleptomaniac");
  }
}

export const antiquarySkillHandlers = Object.freeze({
  "thief.skritt-swipe": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSkrittSwipe,
  }),
  "thief.artifact": augmentAfter(consumeArtifact),
  "thief.forged-surfer": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    afterEffects: completeForgedSurfer,
  }),
  "thief.reshuffle": augmentAfter(reshuffleArtifacts),
  "thief.double-edge": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: (context, skill) =>
      skill.id === ID.STONE_SUMMIT_CANNON ||
      skill.id === ID.CANACH_COIN_TOSS_ID_77230 ||
      peekDoubleEdgeOutcome(context, skill) === "backfire"
        ? SKILL_HANDLER_MODES.REPLACE
        : SKILL_HANDLER_MODES.AUGMENT,
    beforeEffects: resolveDoubleEdge,
  }),
  "thief.skritt-scuffle": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    afterEffects: completeSkrittScuffle,
  }),
});

export const antiquaryTaskHandlers = Object.freeze({
  "thief.forged-surfer": handleForgedSurfer,
  "thief.skritt-scuffle": handleSkrittScuffle,
});

export const antiquarySchedulerHooks = Object.freeze({
  advance: advanceAntiquaryResources,
  onCastStart: spendAntiquaryResources,
  taskHandlers: antiquaryTaskHandlers,
});
