/**
 * Aggregates Revenant's stateful and context-sensitive skill handlers.
 *
 * Direct, unconditional cast packets belong in skill-mechanics.js. Handlers
 * here only augment or replace those packets when legend, upkeep, affinity,
 * allied-player, or other runtime state changes the result.
 */
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";
import {
  activateCosmicWisdom,
  castBeguilingHaze,
  castGladiatorsDefense,
  castHexEaterVortex,
  castReleasePotential,
  castTwinMoonSweep,
  gainAncientEchoEnergy,
  switchAllianceTactics,
} from "./conduit.js";
import { performRevenantDodge } from "./dodge.js";
import { swapRevenantLegend } from "./legend.js";
import {
  activateEnchantedDaggers,
  beginBandTogether,
  castHeroicCommand,
  castOrdersFromAbove,
  completeBandTogether,
  observeBandTogetherEffect,
} from "./assassin-renegade.js";
import {
  castElementalBlast,
  castInspiringReinforcement,
  consumeRevenantFacet,
  releaseRevenantUpkeep,
  toggleRevenantUpkeep,
} from "./upkeep.js";
import { swapRevenantWeapons } from "./shared.js";

function augmentAfter(handler) {
  return augmentSkillHandler(null, { afterEffects: handler });
}
function replaceAfter(handler) {
  return replaceSkillHandler(null, { afterEffects: handler });
}
function dynamicReplacement(handler, afterEffects = null) {
  return replaceSkillHandler(handler, {
    ...(afterEffects ? { afterEffects } : {}),
  });
}

export const revenantSkillHandlers = Object.freeze({
  "revenant.weapon-swap": replaceAfter(swapRevenantWeapons),
  "revenant.legend-swap": replaceAfter(swapRevenantLegend),
  "revenant.dodge": replaceSkillHandler(performRevenantDodge),
  "revenant.enchanted-daggers": replaceAfter(activateEnchantedDaggers),
  "revenant.heroic-command": replaceAfter(castHeroicCommand),
  "revenant.orders-from-above": replaceAfter(castOrdersFromAbove),
  "revenant.band-together": augmentSkillHandler(beginBandTogether, {
    afterEffect: observeBandTogetherEffect,
    afterEffects: completeBandTogether,
  }),
  "revenant.upkeep": replaceAfter(toggleRevenantUpkeep),
  "revenant.upkeep-release": replaceAfter(releaseRevenantUpkeep),
  "revenant.inspiring-reinforcement": dynamicReplacement(
    castInspiringReinforcement,
  ),
  "revenant.elemental-blast": dynamicReplacement(
    castElementalBlast,
    consumeRevenantFacet,
  ),
  "revenant.facet-consume": augmentAfter(consumeRevenantFacet),
  "revenant.ancient-echo": augmentAfter(gainAncientEchoEnergy),
  "revenant.alliance-tactics": augmentAfter(switchAllianceTactics),
  "revenant.beguiling-haze": dynamicReplacement(castBeguilingHaze),
  "revenant.gladiators-defense": dynamicReplacement(castGladiatorsDefense),
  "revenant.hex-eater-vortex": dynamicReplacement(castHexEaterVortex),
  "revenant.twin-moon-sweep": dynamicReplacement(castTwinMoonSweep),
  "revenant.release-potential": dynamicReplacement(castReleasePotential),
  "revenant.cosmic-wisdom": augmentAfter(activateCosmicWisdom),
});
