/** Registers scheduler-phase skill activations for this module. */
import { augmentSkillHandler, skillHandler, SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { emitStealTraitEffects } from '#gw2/professions/thief/core/traits/index.js';
import {
  completeForgedSurfer,
  completeSkrittScuffle,
  consumeArtifact,
  peekDoubleEdgeOutcome,
  pilferArtifacts,
  reshuffleArtifacts,
  resolveDoubleEdge
} from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { ThiefCastContext } from '#gw2/professions/thief/types.js';
import { applySkrittSwipeTraits } from '#gw2/professions/thief/specializations/antiquary/traits/index.js';

function augmentAfter(handler: SkillHandlerPhase<ThiefCastContext>) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

function completeSkrittSwipe(context: ThiefCastContext): void {
  const at = context.effectiveEnd;
  pilferArtifacts(context, at, 'pilfer', 'swipe');
  applySkrittSwipeTraits(context, at);
}

export const antiquarySkillHandlers = Object.freeze({
  'thief.skritt-swipe': augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSkrittSwipe
  }),
  'thief.artifact': augmentAfter(consumeArtifact),
  'thief.forged-surfer': skillHandler({
    mode: SKILL_HANDLER_MODES.REPLACE,
    afterEffects: completeForgedSurfer
  }),
  'thief.reshuffle': augmentAfter(reshuffleArtifacts),
  'thief.double-edge': skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: (context, skill) =>
      // Cannon and Coin Toss always own their own damage packets; a backfire outcome also replaces to prevent the normal damage from firing
      skill.id === ID.STONE_SUMMIT_CANNON ||
      skill.id === ID.CANACH_COIN_TOSS_ID_77230 ||
      peekDoubleEdgeOutcome(context, skill) === 'backfire'
        ? SKILL_HANDLER_MODES.REPLACE
        : SKILL_HANDLER_MODES.AUGMENT,
    beforeEffects: resolveDoubleEdge
  }),
  'thief.skritt-scuffle': skillHandler({
    mode: SKILL_HANDLER_MODES.REPLACE,
    afterEffects: completeSkrittScuffle
  })
});
