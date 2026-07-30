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
import { revenantSpearSkillHandlers } from "./spear.js";
import { performEnergyMeld } from "./dodge.js";
import type {
  SimulationEvent,
  Skill,
  SkillHandlerMode,
  SkillHandlerPhase,
  SkillHandlerStrategy,
} from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";
import type {
  BandTogetherState,
} from "./assassin-renegade.js";

type RevenantHandler = (
  context: RevenantCastContext,
  skill: RevenantSkill,
) => unknown;

function handlerPhase(
  handler: RevenantHandler,
): SkillHandlerPhase<RevenantCastContext> {
  return (context, skill) => handler(context, skill as RevenantSkill);
}

function afterEffectsPhase(
  handler: RevenantHandler,
): NonNullable<
  SkillHandlerStrategy<RevenantCastContext>["afterEffects"]
> {
  return (context, skill) => handler(context, skill as RevenantSkill);
}

function augmentAfter(
  handler: RevenantHandler,
): Readonly<SkillHandlerStrategy<RevenantCastContext>> {
  return augmentSkillHandler<RevenantCastContext>(
    null as unknown as SkillHandlerPhase<RevenantCastContext>,
    { afterEffects: afterEffectsPhase(handler) },
  );
}
function replaceAfter(
  handler: RevenantHandler,
): Readonly<SkillHandlerStrategy<RevenantCastContext>> {
  return replaceSkillHandler<RevenantCastContext>(
    null as unknown as SkillHandlerPhase<RevenantCastContext>,
    { afterEffects: afterEffectsPhase(handler) },
  );
}
function replaceBefore(
  handler: RevenantHandler,
  afterEffects: RevenantHandler | null = null,
): Readonly<SkillHandlerStrategy<RevenantCastContext>> {
  return replaceSkillHandler<RevenantCastContext>(handlerPhase(handler), {
    ...(afterEffects ? { afterEffects: afterEffectsPhase(afterEffects) } : {}),
  });
}

const bandTogether =
  revenantAssassinRenegadeSkillHandlers["revenant.band-together"];

function bandTogetherHandlerMode(
  context: RevenantCastContext,
  skill: Skill,
): SkillHandlerMode {
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
  "revenant.dodge": replaceSkillHandler<RevenantCastContext>(
    handlerPhase(revenantCoreSkillHandlers["revenant.dodge"]),
  ),
  "revenant.energy-meld": augmentAfter(performEnergyMeld),
  "revenant.enchanted-daggers": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.enchanted-daggers"],
  ),
  "revenant.heroic-command": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.heroic-command"],
  ),
  "revenant.orders-from-above": replaceAfter(
    revenantAssassinRenegadeSkillHandlers["revenant.orders-from-above"],
  ),
  "revenant.band-together": augmentSkillHandler<RevenantCastContext>(
    handlerPhase(bandTogether.beforeEffects),
    {
    resolveMode: bandTogetherHandlerMode,
    afterEffect: (
      context,
      skill,
      event,
      state,
    ) => bandTogether.afterEffect(
      context,
      skill as RevenantSkill,
      event as RevenantSimulationEvent,
      state as BandTogetherState,
    ),
    afterEffects: (
      context,
      skill,
      state,
    ) => bandTogether.afterEffects(
      context,
      skill as RevenantSkill,
      state as BandTogetherState,
    ),
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
  "revenant.spear-recharge": augmentSkillHandler<RevenantCastContext>(
    null as unknown as SkillHandlerPhase<RevenantCastContext>,
    {
      afterEffect: (context, skill, event) =>
        revenantSpearSkillHandlers["revenant.spear-recharge"](
          context,
          skill as RevenantSkill,
          event as RevenantSimulationEvent,
        ),
    },
  ),
  "revenant.abyssal-raze": replaceBefore(
    revenantSpearSkillHandlers["revenant.abyssal-raze"],
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
