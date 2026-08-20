import { augmentSkillHandler, replaceSkillHandler } from '../../../platform/engine/skill-handlers.js';
import { gw2WeaponSwapSkillHandler } from '../../../platform/gw2/weapon-swap.js';
import { completeThiefDodge, performThiefDodge } from './dodge.js';
import {
  activateSpiderVenom,
  activateThousandNeedles,
  completeSpearStealthAttack,
  observeSpearChainEffect,
  observeSpiderVenomEffect,
  prepareSpearChainSkill,
  prepareSpearStealthAttack,
  prepareThousandNeedles
} from './conditions.js';
import { activateAssassinsSignet, kneel, stand, summonThievesGuild } from './actions.js';
import { completeSteal, consumeStoredStolenSkill } from './steal.js';
import { beginStealthAttack, completeStealthAttack } from './stealth.js';
import type { SkillHandlerPhase } from '../../../platform/engine/types.js';
import type { ThiefCastContext } from '../types.js';
import { emitStealTraitEffects } from './traits.js';

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
