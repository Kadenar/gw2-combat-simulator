/** Registers scheduler-phase skill activations for this module. */
import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { completeThiefDodge, performThiefDodge } from '#gw2/content/professions/thief/core/skills/dodge.js';
import {
  activateSpiderVenom,
  activateThousandNeedles,
  completeSpearStealthAttack,
  observeSpearChainEffect,
  observeSpiderVenomEffect,
  prepareSpearChainSkill,
  prepareSpearStealthAttack,
  prepareThousandNeedles
} from '#gw2/content/professions/thief/core/skills/spear-and-venoms.js';
import {
  activateAssassinsSignet,
  kneel,
  stand,
  summonThievesGuild
} from '#gw2/content/professions/thief/core/skills/actions.js';
import { completeSteal, consumeStoredStolenSkill } from '#gw2/content/professions/thief/core/mechanics/steal.js';
import { beginStealthAttack, completeStealthAttack } from '#gw2/content/professions/thief/core/mechanics/stealth.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/types.js';
import type { ThiefCastContext } from '#gw2/content/professions/thief/types.js';
import { emitStealTraitEffects } from '#gw2/content/professions/thief/core/traits/index.js';

function augmentAfter(handler: SkillHandlerPhase<ThiefCastContext>) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

export const thiefCoreSkillHandlers = Object.freeze({
  'thief.steal': augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeSteal
  }),
  'thief.stolen-skill': augmentAfter(consumeStoredStolenSkill),
  'thief.dodge': replaceSkillHandler(performThiefDodge, {
    afterEffects: completeThiefDodge
  }),
  'thief.stealth-attack': augmentSkillHandler(beginStealthAttack, {
    afterEffects: completeStealthAttack
  }),
  'thief.spear-chain': augmentSkillHandler(prepareSpearChainSkill, {
    afterEffect: observeSpearChainEffect
  }),
  'thief.spear-stealth-attack': augmentSkillHandler(prepareSpearStealthAttack, {
    afterEffects: completeSpearStealthAttack
  }),
  'thief.spider-venom': augmentSkillHandler(null, {
    afterEffect: observeSpiderVenomEffect,
    afterEffects: activateSpiderVenom
  }),
  'thief.prepare-thousand-needles': augmentAfter(prepareThousandNeedles),
  'thief.thousand-needles': augmentAfter(activateThousandNeedles),
  'thief.assassins-signet': augmentAfter(activateAssassinsSignet),
  'thief.thieves-guild': augmentAfter(summonThievesGuild),
  'thief.weapon-swap': gw2WeaponSwapSkillHandler,
  'thief.kneel': augmentAfter(kneel),
  'thief.free-action': augmentAfter(stand)
});
