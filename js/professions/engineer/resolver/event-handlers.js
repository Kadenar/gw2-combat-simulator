import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../data/ids.js";

function handleEngineerState(context, event) {
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
  };
  Object.assign(
    context.profession,
    structuredClone(event.state || {}),
    preserved,
  );
}

function queueDamage(
  context,
  event,
  {
    name,
    coefficient,
    sourceId = event.skillId,
    actorType = "player",
    at = event.at,
    noCrit = false,
    explosion = false,
  },
) {
  enqueueOrdered(context.queue, {
    type: "damage",
    at,
    name,
    skillName: name,
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: actorType === "effect" ? "Trait" : "engineer",
    sourceId,
    actorType,
    skillId: actorType === "player" ? event.skillId : undefined,
    skillWeapon: actorType === "player" ? "Spear" : "Unequipped",
    noCrit,
    explosion,
    triggeredBy: event.skillName,
  });
}

function queueBuff(
  context,
  event,
  {
    name,
    kind,
    stacks,
    duration,
    sourceId = event.skillId,
    actorType = "player",
  },
) {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    name,
    skillName: name,
    kind,
    stacks,
    duration,
    source: actorType === "effect" ? "Trait" : "engineer",
    sourceId,
    actorType,
    triggeredBy: event.skillName,
  });
}

function applyCondition(
  details,
  context,
  event,
  {
    name,
    condition,
    stacks,
    duration,
    sourceId = event.skillId,
    actorType = "player",
  },
) {
  const application = {
    type: "condition",
    at: event.at,
    name: `${name} — ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: actorType === "effect" ? "Trait" : "engineer",
    sourceId,
    actorType,
    triggeredBy: event.skillName,
  };
  if (details.applyCondition) {
    details.applyCondition(context, application);
  } else {
    enqueueOrdered(context.queue, application);
  }
}

function focused(context, at) {
  return Number(context.profession.focusedUntil || 0) > at;
}

function engineerState(context) {
  return context.state?.profession ?? context.profession;
}

function handleLightningRodPulse(context, event) {
  const isFocused = focused(context, event.at);
  queueDamage(context, event, {
    name: "Lightning Rod",
    coefficient: isFocused ? 0.3 : 0.17,
  });
  if (event.hitIndex === 1) {
    applyCondition({}, context, event, {
      name: "Lightning Rod",
      condition: "Immobilized",
      stacks: 1,
      duration: 2,
    });
  }
}

function handleConduitSurge(context, event) {
  context.profession.focusedUntil = Math.max(
    Number(context.profession.focusedUntil || 0),
    event.at + 10,
  );
  queueDamage(context, event, {
    name: "Conduit Surge",
    coefficient: 1.2,
  });
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    name: "Conduit Surge — Burning",
    skillName: "Conduit Surge",
    condition: "Burning",
    stacks: 1,
    duration: 7,
    source: "engineer",
    sourceId: event.skillId,
    actorType: "player",
  });
}

function handleElectricArtillery(context, event) {
  const isFocused = focused(context, event.at);
  const charges = Math.max(
    0,
    Math.min(12, Math.trunc(Number(event.charges || 0))),
  );
  queueDamage(context, event, {
    name: "Electric Artillery",
    coefficient: isFocused ? 1.5 : 1,
    explosion: true,
  });
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    name: "Electric Artillery — Burning",
    skillName: "Electric Artillery",
    condition: "Burning",
    stacks: 2,
    duration: 3 + charges * (isFocused ? 0.5 : 0.25),
    source: "engineer",
    sourceId: event.skillId,
    actorType: "player",
  });
}

function procState(context) {
  return engineerState(context).traitProcReadyAt;
}

function isExplosion(context, event) {
  if (event.explosion) return true;
  const skill = context.helpers.skillsById?.get(
    event.skillId ?? event.sourceId,
  );
  return (
    skill?.categories?.some(
      (category) => String(category).toLowerCase() === "explosion",
    ) ||
    skill?.kit === "Grenade Kit" ||
    skill?.name === "Devastator"
  );
}

function isAimAssistedProjectile(context, event) {
  if (event.actorType !== "player") return false;
  const skill = context.helpers.skillsById?.get(event.skillId);
  return (
    skill?.kit === "Grenade Kit" ||
    skill?.categories?.some(
      (category) => String(category).toLowerCase() === "projectile",
    )
  );
}

function recordTrait(context, name, event) {
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function reactToEngineerDamage(context, event, details = {}) {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  const criticalChance = Number(
    details.hitContext?.critical?.chance ?? details.criticalChance ?? 0,
  );

  if (
    hasTrait(context, TRAIT.CARBOLIC_COMPOSITION) &&
    event.actorType !== "summon"
  ) {
    applyCondition(details, context, event, {
      name: "Carbolic Composition",
      condition: "Poisoned",
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.CARBOLIC_COMPOSITION,
      actorType: "effect",
    });
  }

  if (
    event.actorType !== "summon" &&
    Number(engineerState(context).rapaciousUntil || 0) > event.at &&
    Number(state.rapacious || 0) <= event.at
  ) {
    state.rapacious = event.at + 0.5;
    queueDamage(context, event, {
      name: "Rapacious Strain",
      coefficient: 0.3,
      sourceId: "engineer.rapacious-strain",
      actorType: "effect",
      noCrit: true,
    });
    recordTrait(context, "Rapacious Strain", event);
  }

  if (
    event.actorType === "player" &&
    hasTrait(context, TRAIT.EXPLOSIVE_ENTRANCE) &&
    !state.explosiveEntranceFired
  ) {
    state.explosiveEntranceFired = true;
    queueDamage(context, event, {
      name: "Explosive Entrance",
      coefficient: 1.25,
      sourceId: TRAIT.EXPLOSIVE_ENTRANCE,
      actorType: "effect",
      explosion: true,
    });
    recordTrait(context, "Explosive Entrance", event);
  }

  const explosion = isExplosion(context, event);
  if (explosion && hasTrait(context, TRAIT.STEEL_PACKED_POWDER)) {
    queueBuff(context, event, {
      name: "Steel-Packed Powder",
      kind: "target-vulnerability",
      stacks: 1,
      duration: 6,
      sourceId: TRAIT.STEEL_PACKED_POWDER,
      actorType: "effect",
    });
  }
  if (explosion && hasTrait(context, TRAIT.SHRAPNEL)) {
    state.shrapnelProgress = Number(state.shrapnelProgress || 0) + 0.33;
    if (state.shrapnelProgress >= 1) {
      state.shrapnelProgress -= 1;
      applyCondition(details, context, event, {
        name: "Shrapnel",
        condition: "Bleeding",
        stacks: 1,
        duration: 6,
        sourceId: TRAIT.SHRAPNEL,
        actorType: "effect",
      });
      queueBuff(context, event, {
        name: "Shrapnel",
        kind: "target-crippled",
        stacks: 1,
        duration: 1,
        sourceId: TRAIT.SHRAPNEL,
        actorType: "effect",
      });
      recordTrait(context, "Shrapnel", event);
    }
  }

  if (
    event.actorType === "player" &&
    hasTrait(context, TRAIT.SERRATED_STEEL) &&
    criticalChance > 0
  ) {
    state.serratedSteelProgress =
      Number(state.serratedSteelProgress || 0) + criticalChance * 0.33;
    if (state.serratedSteelProgress >= 1) {
      state.serratedSteelProgress -= 1;
      applyCondition(details, context, event, {
        name: "Serrated Steel",
        condition: "Bleeding",
        stacks: 1,
        duration: 3,
        sourceId: TRAIT.SERRATED_STEEL,
        actorType: "effect",
      });
      recordTrait(context, "Serrated Steel", event);
    }
  }

  if (
    event.actorType === "player" &&
    hasTrait(context, TRAIT.INCENDIARY_POWDER) &&
    criticalChance > 0
  ) {
    state.incendiaryProgress =
      Number(state.incendiaryProgress || 0) + criticalChance;
    if (
      state.incendiaryProgress >= 1 &&
      Number(state.incendiaryPowder || 0) <= event.at
    ) {
      state.incendiaryProgress -= 1;
      state.incendiaryPowder = event.at + 10;
      applyCondition(details, context, event, {
        name: "Incendiary Powder",
        condition: "Burning",
        stacks: 1,
        duration: 8,
        sourceId: TRAIT.INCENDIARY_POWDER,
        actorType: "effect",
      });
      recordTrait(context, "Incendiary Powder", event);
    }
  }

  if (
    hasTrait(context, TRAIT.AIM_ASSISTED_ROCKET) &&
    isAimAssistedProjectile(context, event) &&
    Number(state.aimAssistedRocket || 0) <= event.at
  ) {
    state.aimAssistedRocket = event.at + 3;
    state.aimAssistedRocketCount =
      Number(state.aimAssistedRocketCount || 0) + 1;
    const orbital = state.aimAssistedRocketCount % 5 === 0;
    queueDamage(context, event, {
      name: orbital ? "Orbital Command Strike" : "Aim-Assisted Rocket",
      coefficient: orbital ? 2 : 1,
      sourceId: orbital
        ? "engineer.orbital-command-strike"
        : TRAIT.AIM_ASSISTED_ROCKET,
      actorType: "effect",
      at: event.at + (orbital ? 2 : 0.07),
      explosion: true,
    });
    recordTrait(
      context,
      orbital ? "Orbital Command Strike" : "Aim-Assisted Rocket",
      event,
    );
  }
}

function reactToEngineerCondition(context, event) {
  if (
    event.condition === "Burning" &&
    hasTrait(context, TRAIT.THERMAL_VISION)
  ) {
    const state = engineerState(context);
    state.traitProcReadyAt.thermalVisionUntil = Math.max(
      Number(state.traitProcReadyAt.thermalVisionUntil || 0),
      event.at + 4,
    );
  }
  if (
    event.condition === "Bleeding" &&
    hasTrait(context, TRAIT.HEMATIC_FOCUS)
  ) {
    queueBuff(context, event, {
      name: "Hematic Focus",
      kind: "fury",
      stacks: 1,
      duration: 8,
      sourceId: TRAIT.HEMATIC_FOCUS,
      actorType: "effect",
    });
  }
}

export const engineerResolverEventHandlers = Object.freeze({
  "engineer.state": handleEngineerState,
  "engineer.lightning-rod-pulse": handleLightningRodPulse,
  "engineer.conduit-surge": handleConduitSurge,
  "engineer.electric-artillery": handleElectricArtillery,
});

export const engineerResolverEventReactions = Object.freeze({
  damage: reactToEngineerDamage,
  condition: reactToEngineerCondition,
});
