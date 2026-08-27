import {
  augmentSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES
} from '../../../../../platform/engine/skills/handlers.js';
import { THIEF_SKILL_IDS as ID } from '../../data/ids.js';
import { emitStealTraitEffects } from '../../core/traits.js';
import {
  completeForgedSurfer,
  completeSkrittScuffle,
  consumeArtifact,
  peekDoubleEdgeOutcome,
  pilferArtifacts,
  reshuffleArtifacts,
  resolveDoubleEdge
} from './artifacts.js';
import type { SkillHandlerPhase } from '../../../../../platform/engine/types.js';
import type { ThiefCastContext } from '../../types.js';
import { applySkrittSwipeTraits } from './traits.js';

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
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE, // emits a task-driven sequence; the default cast resolve path must be suppressed
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
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE, // the scuffle deals no immediate damage; replace prevents the engine from emitting a generic strike
    afterEffects: completeSkrittScuffle
  })
});
