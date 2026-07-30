import {
  augmentSkillHandler,
  replaceSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";
import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import {
  activateAssassinsSignet,
  completeForgedSurfer,
  completeSkrittScuffle,
  consumeArtifact,
  peekDoubleEdgeOutcome,
  reshuffleArtifacts,
  resolveDoubleEdge,
} from "./artifacts.js";
import {
  completeThiefDodge,
  performThiefDodge,
} from "./dodge.js";
import {
  activateCaltrops,
  activateSpiderVenom,
  activateThousandNeedles,
  completeSpearStealthAttack,
  observeSpearChainEffect,
  observeSpearStealthEffect,
  prepareSpearChainSkill,
  prepareSpearStealthAttack,
  prepareThousandNeedles,
} from "./condition-antiquary.js";
import {
  enterShadowShroud,
  exitShadowShroud,
  kneel,
  stand,
  summonThievesGuild,
  swapThiefWeapons,
} from "./skills.js";
import {
  completeSkrittSwipe,
  completeSteal,
  consumeStoredStolenSkill,
  emitStealTraitEffects,
} from "./steal.js";
import {
  beginStealthAttack,
  completeStealthAttack,
} from "./stealth.js";

function augmentAfter(handler) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

export const thiefSkillHandlers = Object.freeze({
  "thief.steal": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSteal,
  }),
  "thief.skritt-swipe": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSkrittSwipe,
  }),
  "thief.stolen-skill": augmentAfter(consumeStoredStolenSkill),
  "thief.dodge": replaceSkillHandler(performThiefDodge, {
    afterEffects: completeThiefDodge,
  }),
  "thief.stealth-attack": augmentSkillHandler(beginStealthAttack, {
    afterEffects: completeStealthAttack,
  }),
  "thief.spear-chain": augmentSkillHandler(prepareSpearChainSkill, {
    afterEffect: observeSpearChainEffect,
  }),
  "thief.spear-stealth-attack": augmentSkillHandler(
    prepareSpearStealthAttack,
    {
      afterEffect: observeSpearStealthEffect,
      afterEffects: completeSpearStealthAttack,
    },
  ),
  "thief.spider-venom": augmentAfter(activateSpiderVenom),
  "thief.prepare-thousand-needles": augmentAfter(prepareThousandNeedles),
  "thief.thousand-needles": augmentAfter(activateThousandNeedles),
  "thief.caltrops": augmentAfter(activateCaltrops),
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
      skill.id === ID.STONE_SUMMIT_CANNON
      || skill.id === ID.CANACH_COIN_TOSS_ID_77230
      || peekDoubleEdgeOutcome(context, skill) === "backfire"
        ? SKILL_HANDLER_MODES.REPLACE
        : SKILL_HANDLER_MODES.AUGMENT,
    beforeEffects: resolveDoubleEdge,
  }),
  "thief.skritt-scuffle": skillHandler({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    afterEffects: completeSkrittScuffle,
  }),
  "thief.assassins-signet": augmentAfter(activateAssassinsSignet),
  "thief.thieves-guild": augmentAfter(summonThievesGuild),
  "thief.weapon-swap": replaceSkillHandler(swapThiefWeapons),
  "thief.kneel": augmentAfter(kneel),
  "thief.free-action": augmentAfter(stand),
  "thief.shadow-shroud-enter": augmentAfter(enterShadowShroud),
  "thief.shadow-shroud-exit": augmentAfter(exitShadowShroud),
});
