import {
  gw2AlliedPlayerAssumptions,
  gw2AlliedPlayerProcTimeline,
} from "../../../../platform/gw2/allied-players.js";
import { emitRevenantState } from "./shared.js";
import { emitRevenantBoon } from "./conduit.js";
import {
  REVENANT_HANDLER_MECHANICS as MECHANICS,
} from "../handler-mechanics.js";
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasRevenantTrait } from "../../state.js";

function hasTrait(context, traitId) {
  return hasRevenantTrait(context.config, traitId);
}

export function isBandTogetherReady(state, at) {
  return Boolean(state.bandTogetherReady)
    && Number(state.bandTogetherExpiresAt || 0) > at;
}

function fervorDuration(context) {
  const profile = MECHANICS.renegade.kallasFervor;
  return hasTrait(context, TRAIT.LASTING_LEGACY)
    ? profile.improvedDuration
    : profile.duration;
}

export function activeKallasFervorStacks(state, at) {
  const maximum = MECHANICS.renegade.kallasFervor.maximumStacks;
  return Math.min(
    maximum,
    (state.kallasFervor || []).filter(application =>
      Number(application.at || 0) <= at
      && Number(application.expiresAt || 0) > at).length,
  );
}

function pruneKallasFervor(state, at) {
  state.kallasFervor = (state.kallasFervor || [])
    .filter(application => Number(application.expiresAt || 0) > at);
}

export function grantKallasFervor(context, cause, {
  at = cause.at,
  sourceId = cause.sourceId,
  sourceName = cause.skillName || cause.name || "Kalla's Fervor",
} = {}) {
  const state = context.state.profession;
  const profile = MECHANICS.renegade.kallasFervor;
  pruneKallasFervor(state, at);
  if (activeKallasFervorStacks(state, at) >= profile.maximumStacks) return false;
  const duration = fervorDuration(context);
  state.kallasFervor.push({ at, expiresAt: at + duration });
  context.emitDerived(cause, {
    type: "buff",
    at,
    source: "revenant",
    sourceId,
    actorType: "player",
    skillId: sourceId,
    skillName: sourceName,
    name: `${sourceName} â€” Kalla's Fervor`,
    kind: "kallas-fervor",
    duration,
    stacks: 1,
  });
  emitRevenantState(context, at, "kallas-fervor");
  return true;
}

function refreshKallasFervor(context, at) {
  const state = context.state.profession;
  pruneKallasFervor(state, at);
  const duration = fervorDuration(context);
  for (const application of state.kallasFervor) {
    if (Number(application.at || 0) <= at) {
      application.expiresAt = at + duration;
    }
  }
  if (state.kallasFervor.length) {
    emitRevenantState(context, at, "kallas-fervor-refreshed");
  }
  return activeKallasFervorStacks(state, at);
}

function scaledBoonDuration(context, skill, boon, duration) {
  return context.schedulerPolicy.effectDuration?.(
    context,
    skill,
    { type: "boon", boon },
    duration,
  ) ?? duration;
}

export function castHeroicCommand(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const at = context.effectiveEnd;
  const stacks = refreshKallasFervor(context, at);
  if (!stacks) return;
  const profile = MECHANICS.renegade.heroicCommand;
  const mightPerFervor = hasTrait(context, TRAIT.LASTING_LEGACY)
    ? profile.improvedMightPerFervor
    : profile.mightPerFervor;
  emitRevenantBoon(
    context,
    skill,
    "might",
    scaledBoonDuration(context, skill, "might", profile.mightDuration),
    stacks * mightPerFervor,
    { at },
  );
}

export function castOrdersFromAbove(context, skill) {
  const profile = MECHANICS.renegade.ordersFromAbove;
  const pulses = hasTrait(context, TRAIT.RIGHTEOUS_REBEL)
    ? profile.improvedPulses
    : profile.pulses;
  const duration = scaledBoonDuration(
    context,
    skill,
    "alacrity",
    profile.alacrityDuration,
  );
  for (let index = 0; index < pulses; index += 1) {
    emitRevenantBoon(
      context,
      skill,
      "alacrity",
      duration,
      1,
      {
        at: context.effectiveEnd + index * profile.interval,
        extendsResolutionHorizon: index === pulses - 1,
      },
    );
  }
}

function emitCondition(context, skill, {
  at = context.effectiveEnd,
  condition,
  stacks,
  duration,
  actorType = "summon",
  name = `${skill.name} â€” ${condition}`,
  ...metadata
}) {
  context.emit({
    type: "condition",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType,
    skillId: skill.id,
    skillName: skill.name,
    name,
    condition,
    stacks,
    duration,
    ...metadata,
  });
}

export function activateEnchantedDaggers(context, skill) {
  const profile = MECHANICS.enchantedDaggers;
  const at = context.effectiveEnd;
  context.state.profession.enchantedDaggers = {
    charges: profile.charges,
    expiresAt: at + profile.duration,
    readyAt: at,
  };
  context.emit({
    type: "buff",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: "Enchanted Daggers",
    kind: "enchanted-daggers",
    duration: profile.duration,
    stacks: profile.charges,
  });
  emitRevenantState(context, at, "enchanted-daggers");
}

export function beginBandTogether(context, skill) {
  const profession = context.state.profession;
  const enhanced = isBandTogetherReady(profession, context.start);
  profession.bandTogetherReady = false;
  profession.bandTogetherExpiresAt = 0;
  if (enhanced && hasTrait(context, TRAIT.ALL_FOR_ONE)) {
    const state = context.state.profession;
    state.energy = Math.min(
      state.maximumEnergy,
      Number(state.energy || 0) + MECHANICS.renegade.allForOne.energy,
    );
    emitRevenantState(context, context.start, "all-for-one");
  }
  return { enhanced };
}

export function observeBandTogetherEffect(
  context,
  skill,
  event,
  state,
) {
  if (
    skill.id === ID.ICERAZORS_IRE
    && state.enhanced
  ) {
    const profile = MECHANICS.bandTogether.icerazor;
    context.replaceEvent(event, {
      at:
        context.start
        + (
          event.type === "damage"
            ? Math.max(0, Number(event.hitIndex || 1) - 1)
              * profile.packetInterval
            : event.condition === "Immobilized"
              ? profile.enhancedImpactDelay
              : 0
        ),
    });
    return;
  }
  if (skill.id !== ID.DARKRAZORS_DARING) return;
  if (event.type === "buff" && event.kind === "stability") {
    const profile = MECHANICS.bandTogether.darkrazor;
    context.replaceEvent(event, {
      recipients:
        event.duration === profile.casterStabilityDuration
          ? "self"
          : "allies",
      ...(event.duration === profile.alliedStabilityDuration
        ? { extendsResolutionHorizon: true }
        : {}),
    });
  }
  if (state.enhanced && event.type === "control") {
    const profile = MECHANICS.bandTogether.darkrazor;
    context.replaceEvent(event, {
      breakbar: profile.enhancedBreakbar,
      bonusDefianceBreak: profile.bonusDefianceBreak,
    });
  }
}

function grantRazorclawsRage(context, skill) {
  const profile = MECHANICS.bandTogether.razorclaw;
  const at = context.effectiveEnd;
  const party = gw2AlliedPlayerAssumptions(context.config);
  context.state.profession.razorclawsRage = {
    charges: profile.charges,
    expiresAt: at + profile.duration,
    readyAt: at,
  };
  context.emit({
    type: "buff",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: "Razorclaw's Rage",
    kind: "razorclaws-rage",
    duration: profile.duration,
    stacks: profile.charges,
    recipients: "party",
    recipientCount: party.count + 1,
  });
  const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
    start: at,
    duration: profile.duration,
    maximumPerAlly: profile.charges,
    internalCooldown: profile.interval,
  });
  for (let index = 0; index < alliedProcs.length; index += 1) {
    const proc = alliedProcs[index];
    emitCondition(context, skill, {
      at: proc.at,
      condition: "Bleeding",
      stacks: 1,
      duration: profile.bleedDuration,
      actorType: "player",
      name: `Razorclaw's Rage â€” Ally ${proc.allyIndex} Bleeding`,
      triggeredByAlly: proc.allyIndex,
      ...(index === alliedProcs.length - 1
        ? { extendsResolutionHorizon: true }
        : {}),
    });
  }
}

export function completeBandTogether(context, skill, state) {
  if (skill.id === ID.RAZORCLAWS_RAGE) {
    grantRazorclawsRage(context, skill);
  }
  if (state.enhanced) {
    if (skill.id === ID.RAZORCLAWS_RAGE) {
      const profile = MECHANICS.bandTogether.razorclaw;
      emitCondition(context, skill, {
        condition: "Torment",
        stacks: profile.enhancedTormentStacks,
        duration: profile.enhancedTormentDuration,
      });
    } else if (skill.id === ID.ICERAZORS_IRE) {
      const profile = MECHANICS.bandTogether.icerazor;
      for (let hitIndex = 0; hitIndex < 3; hitIndex += 1) {
        emitCondition(context, skill, {
          at: context.start + hitIndex * profile.packetInterval,
          condition: "Chilled",
          stacks: 1,
          duration: profile.enhancedChill,
          actorType: "player",
        });
      }
    } else if (skill.id === ID.DARKRAZORS_DARING) {
      const profile = MECHANICS.bandTogether.darkrazor;
      emitRevenantBoon(
        context,
        skill,
        "resistance",
        profile.resistance,
        1,
        { recipients: "allies" },
      );
      emitRevenantBoon(
        context,
        skill,
        "protection",
        profile.protection,
        1,
        { recipients: "allies" },
      );
    }
  }
  if (!state.enhanced) {
    context.state.profession.bandTogetherReady = true;
    context.state.profession.bandTogetherExpiresAt =
      context.effectiveEnd + MECHANICS.bandTogether.duration;
    emitRevenantState(context, context.effectiveEnd, "band-together");
  }
}
