/**
 * Aggregates Revenant's stateful and context-sensitive skill handlers.
 *
 * Direct, unconditional cast packets belong in skill-mechanics.js. Handlers
 * here only augment or replace those packets when legend, upkeep, affinity,
 * allied-player, or other runtime state changes the result.
 *
 * Feature modules export raw callbacks. This registry is the sole layer that
 * assigns the shared beforeEffects/afterEffect/afterEffects phases and the
 * augment/replace strategy consumed by the canonical catalog.
 */
import {
  augmentSkillHandler,
  replaceSkillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";
import { revenantConduitSkillHandlers } from "./conduit.js";
import { revenantAssassinRenegadeSkillHandlers } from "./assassin-renegade.js";
import { revenantUpkeepSkillHandlers } from "./upkeep.js";
import { revenantCoreSkillHandlers } from "./core.js";

function augmentAfter(handler) {
  return augmentSkillHandler(null, { afterEffects: handler });
}
function replaceAfter(handler) {
  return replaceSkillHandler(null, { afterEffects: handler });
}
function replaceBefore(handler, afterEffects = null) {
  return replaceSkillHandler(handler, {
    ...(afterEffects ? { afterEffects } : {}),
  });
}

const bandTogether =
  revenantAssassinRenegadeSkillHandlers["revenant.band-together"];

function bandTogetherHandlerMode(context, skill) {
  return bandTogether.replacesEffects(context, skill)
    ? SKILL_HANDLER_MODES.REPLACE
    : SKILL_HANDLER_MODES.AUGMENT;
}

/**
 * Catalog-facing handler strategies keyed by the `handlerId` values declared
 * in skill-mechanics.js.
 */
export const revenantSkillHandlers = Object.freeze({
  "revenant.weapon-swap": replaceAfter(
    revenantCoreSkillHandlers["revenant.weapon-swap"],
  ),
  "revenant.legend-swap": replaceAfter(
    revenantCoreSkillHandlers["revenant.legend-swap"],
  ),
  "revenant.dodge": replaceSkillHandler(
    revenantCoreSkillHandlers["revenant.dodge"],
  ),
  "revenant.enchanted-daggers": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.enchanted-daggers"],
  ),
  "revenant.heroic-command": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.heroic-command"],
  ),
  "revenant.orders-from-above": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.orders-from-above"],
  ),
  "revenant.band-together": augmentSkillHandler(bandTogether.beforeEffects, {
    resolveMode: bandTogetherHandlerMode,
    afterEffect: bandTogether.afterEffect,
    afterEffects: bandTogether.afterEffects,
  }),
  "revenant.upkeep": replaceAfter(
    revenantUpkeepSkillHandlers["revenant.upkeep"],
  ),
  "revenant.upkeep-release": replaceAfter(
    revenantUpkeepSkillHandlers["revenant.upkeep-release"],
  ),
  "revenant.inspiring-reinforcement": replaceBefore(
    revenantUpkeepSkillHandlers["revenant.inspiring-reinforcement"],
  ),
  "revenant.elemental-blast": replaceBefore(
    revenantUpkeepSkillHandlers["revenant.elemental-blast"],
    revenantUpkeepSkillHandlers["revenant.facet-consume"],
  ),
  "revenant.facet-consume": augmentAfter(
    revenantUpkeepSkillHandlers["revenant.facet-consume"],
  ),
  "revenant.ancient-echo": augmentAfter(
    revenantConduitSkillHandlers["revenant.ancient-echo"],
  ),
  "revenant.alliance-tactics": augmentAfter(
    revenantConduitSkillHandlers["revenant.alliance-tactics"],
  ),
  "revenant.beguiling-haze": replaceBefore(
    revenantConduitSkillHandlers["revenant.beguiling-haze"],
  ),
  "revenant.gladiators-defense": replaceBefore(
    revenantConduitSkillHandlers["revenant.gladiators-defense"],
  ),
  "revenant.hex-eater-vortex": replaceBefore(
    revenantConduitSkillHandlers["revenant.hex-eater-vortex"],
  ),
  "revenant.twin-moon-sweep": replaceBefore(
    revenantConduitSkillHandlers["revenant.twin-moon-sweep"],
  ),
  "revenant.release-potential": replaceBefore(
    revenantConduitSkillHandlers["revenant.release-potential"],
  ),
  "revenant.cosmic-wisdom": augmentAfter(
    revenantConduitSkillHandlers["revenant.cosmic-wisdom"],
  ),
});
