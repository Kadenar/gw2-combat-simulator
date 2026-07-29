import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";
import {
  consumeArtifact,
  reshuffleArtifacts,
  resolveDoubleEdge,
} from "./artifacts.js";
import {
  completeThiefDodge,
  performThiefDodge,
} from "./dodge.js";
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
  "thief.artifact": augmentAfter(consumeArtifact),
  "thief.reshuffle": augmentAfter(reshuffleArtifacts),
  "thief.double-edge": augmentAfter(resolveDoubleEdge),
  "thief.thieves-guild": augmentAfter(summonThievesGuild),
  "thief.weapon-swap": replaceSkillHandler(swapThiefWeapons),
  "thief.kneel": augmentAfter(kneel),
  "thief.free-action": augmentAfter(stand),
  "thief.shadow-shroud-enter": augmentAfter(enterShadowShroud),
  "thief.shadow-shroud-exit": augmentAfter(exitShadowShroud),
});
