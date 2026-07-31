import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import {
  completeThiefDodge,
  performThiefDodge,
} from "./dodge.js";
import {
  activateCaltrops,
  activateSpiderVenom,
  activateThousandNeedles,
  completeSpearStealthAttack,
  handleCaltropsPulse,
  handleThousandNeedlesPulse,
  observeSpearChainEffect,
  prepareSpearChainSkill,
  prepareSpearStealthAttack,
  prepareThousandNeedles,
} from "./conditions.js";
import {
  activateAssassinsSignet,
  handleThievesGuildAttack,
  kneel,
  stand,
  summonThievesGuild,
  swapThiefWeapons,
} from "./actions.js";
import {
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

export const thiefCoreSkillHandlers = Object.freeze({
  "thief.steal": augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSteal,
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
      afterEffects: completeSpearStealthAttack,
    },
  ),
  "thief.spider-venom": augmentAfter(activateSpiderVenom),
  "thief.prepare-thousand-needles": augmentAfter(prepareThousandNeedles),
  "thief.thousand-needles": augmentAfter(activateThousandNeedles),
  "thief.caltrops": augmentAfter(activateCaltrops),
  "thief.assassins-signet": augmentAfter(activateAssassinsSignet),
  "thief.thieves-guild": augmentAfter(summonThievesGuild),
  "thief.weapon-swap": replaceSkillHandler(swapThiefWeapons),
  "thief.kneel": augmentAfter(kneel),
  "thief.free-action": augmentAfter(stand),
});

export const thiefCoreTaskHandlers = Object.freeze({
  "thief.thieves-guild-attack": handleThievesGuildAttack,
  "thief.thousand-needles-pulse": handleThousandNeedlesPulse,
  "thief.caltrops-pulse": handleCaltropsPulse,
});
