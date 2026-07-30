import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";

function handleEngineerState(context, event) {
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
    activeComboFields: context.profession.activeComboFields || [],
    completedBlastFinisherActivations:
      context.profession.completedBlastFinisherActivations || {},
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
    blastFinisher = false,
    weaponStrength,
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
    blastFinisher,
    ...(blastFinisher
      ? { finisherType: "Blast", finisherValue: 1 }
      : {}),
    ...(weaponStrength == null ? {} : { weaponStrength }),
    triggeredBy: event.skillName,
  });
}

function handleEngineerComboField(context, event) {
  const state = engineerState(context);
  const fields = state.activeComboFields || [];
  state.activeComboFields = fields
    .filter(field => Number(field.expiresAt || 0) >= event.at)
    .concat({
      startsAt: event.at,
      expiresAt: Number(event.expiresAt || event.at),
      fieldType: event.fieldType,
      skillId: event.skillId,
      skillName: event.skillName,
    });
}

function hasActiveEngineerComboField(context, at) {
  const state = engineerState(context);
  state.activeComboFields = (state.activeComboFields || [])
    .filter(field => Number(field.expiresAt || 0) >= at);
  return state.activeComboFields.some(field =>
    Number(field.startsAt || 0) <= at
    && Number(field.expiresAt || 0) >= at);
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
    metadata = {},
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
    ...metadata,
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
  const state = engineerState(context);
  state.traitProcReadyAt ||= {};
  return state.traitProcReadyAt;
}

function isExplosion(context, event) {
  if (event.explosion || event.damageKind === "explosion") return true;
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
  if (
    event.actorType === "summon"
    && [
      ID.SPARK_REVOLVER,
      ID.CORE_REACTOR_SHOT,
      ID.JADE_MORTAR,
    ].includes(event.skillId)
    && isEngineerMechEvent(context, event)
  ) return true;
  if (event.actorType !== "player") return false;
  if (event.projectile === true) return true;
  const skill = context.helpers.skillsById?.get(event.skillId);
  return (
    skill?.kit === "Grenade Kit" ||
    skill?.categories?.some(
      (category) => String(category).toLowerCase() === "projectile",
    )
  );
}

function recordTrait(context, name, event, icon = "") {
  context.recordProc?.("trait", name, event.at, event.skillName, "", icon);
}

function isEngineerMechEvent(context, event) {
  if (
    event.engineerMech === true
    || event.application?.engineerMech === true
  ) return true;
  if (
    context.config.specialization !== "Mechanist"
    || event.actorType !== "summon"
  ) return false;
  const skill = context.helpers.skillsById?.get(
    event.skillId ?? event.application?.skillId,
  );
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

function isAmalgamSkillHit(context, event) {
  if (
    context.config.specialization !== "Amalgam"
    || event.actorType === "summon"
  ) return false;
  // Rapacious Strain is an Amalgam strike even though ArcDPS exposes its
  // damage skill only in the combat log, not the API catalog. Other derived
  // effects must not inherit Amalgam status from the skill that triggered
  // them (for example Explosive Entrance triggered by Flux State).
  if (event.actorType === "effect") {
    return event.name === "Rapacious Strain";
  }
  const skill = context.helpers.skillsById?.get(event.skillId);
  return (
    skill?.specialization === "Amalgam"
    || skill?.categories?.includes("Amalgam")
    || skill?.categories?.includes("Morph")
  );
}

function activeBoonStacks(context, kind, maximum = 25, at = 0) {
  const normalized = String(kind || "").toLowerCase();
  const permanent = context.config?.boons?.[normalized];
  const base = permanent === true ? 1 : Number(permanent || 0);
  const applications = context.boons?.get(normalized) || [];
  const dynamic = applications
    .filter(application =>
      application.at <= at
      && application.expiresAt > at)
    .reduce(
      (sum, application) => sum + Number(application.stacks || 1),
      0,
    );
  return Math.max(0, Math.min(maximum, base + dynamic));
}

function usesRandomTraitProcs(context) {
  return context.random?.stochastic === true;
}

function rolledCritical(details) {
  return details.hitContext?.critical?.didCrit === true;
}

function scheduleMassMomentumPulse(context, at) {
  const state = procState(context);
  const scheduledAt = Number(state.massMomentumPulseAt || 0);
  if (scheduledAt > 0 && scheduledAt <= at + 1e-9) return;
  state.massMomentumPulseAt = at;
  enqueueOrdered(context.queue, {
    type: "engineer.mass-momentum-pulse",
    at,
    source: "Trait",
    sourceId: TRAIT.MASS_MOMENTUM,
    actorType: "effect",
  });
}

function triggerMassMomentum(context, event) {
  if (
    !hasTrait(context, TRAIT.MASS_MOMENTUM)
    || activeBoonStacks(context, "stability", 1, event.at) === 0
  ) return;
  const state = procState(context);
  if (Number(state.massMomentum || 0) <= event.at) {
    state.massMomentum = event.at + 1;
    queueBuff(context, event, {
      name: "Mass Momentum",
      kind: "might",
      stacks: 1,
      duration: 5,
      sourceId: TRAIT.MASS_MOMENTUM,
      actorType: "effect",
    });
    recordTrait(context, "Mass Momentum", event);
  }
  scheduleMassMomentumPulse(
    context,
    Math.max(event.at + 1, Number(state.massMomentum || 0)),
  );
}

function handleEngineerDodge(context) {
  procState(context).explosiveEntranceFired = false;
}

function handleMassMomentumPulse(context, event) {
  const state = procState(context);
  if (
    Math.abs(Number(state.massMomentumPulseAt || 0) - event.at) <= 1e-9
  ) {
    state.massMomentumPulseAt = 0;
  }
  triggerMassMomentum(context, event);
}

function reactToEngineerDamage(context, event, details = {}) {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  const criticalChance = Number(
    details.hitContext?.critical?.chance ?? details.criticalChance ?? 0,
  );
  const mechEvent = isEngineerMechEvent(context, event);

  const skill = context.helpers.skillsById?.get(event.skillId);
  const finisherType = event.finisherType || skill?.finisherType;
  const finisherValue = Number(
    event.finisherValue ?? skill?.finisherValue ?? 0,
  );
  const comboState = engineerState(context);
  const activation = String(
    event.activationId || `${event.skillId || event.sourceId}:${event.at}`,
  );
  if (
    finisherType === "Blast"
    && finisherValue > 0
    && hasActiveEngineerComboField(context, event.at)
    && !comboState.completedBlastFinisherActivations[activation]
  ) {
    comboState.completedBlastFinisherActivations[activation] = true;
    const blastCount = Math.max(1, Math.trunc(finisherValue));
    for (let blastIndex = 1; blastIndex <= blastCount; blastIndex += 1) {
      enqueueOrdered(context.queue, {
        type: "blast_combo",
        at: event.at,
        source: "engineer",
        sourceId: event.sourceId,
        actorType: "player",
        skillId: event.skillId,
        skillName: event.skillName,
        name: `${event.skillName} — Blast Combo`,
        blastIndex,
        totalBlasts: blastCount,
      });
    }
  }

  if (
    mechEvent
    && hasTrait(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS)
    && Number(state.singleEdgeCutters || 0) <= event.at
  ) {
    state.singleEdgeCutters = event.at + 1;
    applyCondition(details, context, event, {
      name: "Mech Arms: Single-Edge Cutters",
      condition: "Bleeding",
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      actorType: "summon",
      metadata: { engineerMech: true },
    });
    recordTrait(context, "Mech Arms: Single-Edge Cutters", event);
  }

  if (
    mechEvent
    && hasTrait(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS)
    && Number(state.highImpactDrivers || 0) <= event.at
  ) {
    state.highImpactDrivers = event.at + 1;
    queueBuff(context, event, {
      name: "Mech Arms: High-Impact Drivers",
      kind: "might",
      stacks: 1,
      duration: 10,
      sourceId: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
      actorType: "effect",
    });
    recordTrait(context, "Mech Arms: High-Impact Drivers", event);
  }

  if (
    mechEvent
    && event.mechBasicAttack === true
    && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS)
  ) {
    applyCondition(details, context, event, {
      name: "Mech Arms: Jade Cannons",
      condition: "Vulnerability",
      stacks: 1,
      duration: 6,
      sourceId: TRAIT.MECH_ARMS_JADE_CANNONS,
      actorType: "summon",
      metadata: { engineerMech: true },
    });
  }

  if (
    hasTrait(context, TRAIT.CARBOLIC_COMPOSITION)
    && isAmalgamSkillHit(context, event)
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
    // The supplied benchmark records 39 procs across its four eight-second
    // Rapacious windows, matching a 600 ms internal cadence.
    state.rapacious = event.at + 0.6;
    queueDamage(context, event, {
      name: "Rapacious Strain",
      coefficient: 0.3,
      sourceId: "engineer.rapacious-strain",
      actorType: "effect",
    });
    recordTrait(
      context,
      "Rapacious Strain",
      event,
      "https://render.guildwars2.com/file/"
        + "5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png",
    );
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
      duration: 5,
      sourceId: TRAIT.STEEL_PACKED_POWDER,
      actorType: "effect",
    });
  }
  if (
    explosion
    && hasTrait(context, TRAIT.SHORT_FUSE)
    && Number(state.shortFuse || 0) <= event.at
  ) {
    state.shortFuse = event.at + 3;
    queueBuff(context, event, {
      name: "Short Fuse",
      kind: "fury",
      stacks: 1,
      duration: 4,
      sourceId: TRAIT.SHORT_FUSE,
      actorType: "effect",
    });
    recordTrait(context, "Short Fuse", event);
  }
  if (explosion && hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    queueBuff(context, event, {
      name: "Explosive Temper",
      kind: "explosive-temper",
      stacks: 1,
      duration: 10,
      sourceId: TRAIT.EXPLOSIVE_TEMPER,
      actorType: "effect",
    });
    recordTrait(context, "Explosive Temper", event);
  }
  if (
    event.name === "Explosive Entrance"
    && hasTrait(context, TRAIT.GRAND_ENTRANCE)
  ) {
    queueBuff(context, event, {
      name: "Grand Entrance — resistance",
      kind: "resistance",
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: "effect",
    });
    queueBuff(context, event, {
      name: "Grand Entrance",
      kind: "grand-entrance",
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: "effect",
    });
    recordTrait(context, "Grand Entrance", event);
  }
  if (
    explosion
    && event.name !== "Aim-Assisted Rocket"
    && hasTrait(context, TRAIT.SHRAPNEL)
  ) {
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered = context.random.roll(0.33, "engineer.shrapnel");
    } else {
      state.shrapnelProgress = Number(state.shrapnelProgress || 0) + 0.33;
      triggered = state.shrapnelProgress >= 1;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state.shrapnelProgress -= 1;
      }
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
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered =
        rolledCritical(details) &&
        context.random.roll(0.33, "engineer.serrated-steel");
    } else {
      state.serratedSteelProgress =
        Number(state.serratedSteelProgress || 0) + criticalChance * 0.33;
      triggered = state.serratedSteelProgress >= 1;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state.serratedSteelProgress -= 1;
      }
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
    event.actorType === "player"
    && hasTrait(context, TRAIT.NO_SCOPE)
    && criticalChance > 0
    && Number(state.noScope || 0) <= event.at
  ) {
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered = rolledCritical(details);
    } else {
      state.noScopeProgress =
        Number(state.noScopeProgress || 0) + criticalChance;
      triggered = state.noScopeProgress >= 1;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) state.noScopeProgress -= 1;
      state.noScope = event.at + 8;
      queueBuff(context, event, {
        name: "No Scope",
        kind: "fury",
        stacks: 1,
        duration: 4,
        sourceId: TRAIT.NO_SCOPE,
        actorType: "effect",
      });
      recordTrait(context, "No Scope", event);
    }
  }

  if (
    ["player", "summon"].includes(event.actorType) &&
    hasTrait(context, TRAIT.INCENDIARY_POWDER) &&
    criticalChance > 0
  ) {
    const owner = event.actorType === "summon" ? "mech" : "player";
    const readyKey = `incendiaryPowder.${owner}`;
    const progressKey = `incendiaryProgress.${owner}`;
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered =
        rolledCritical(details) &&
        Number(state[readyKey] || 0) <= event.at;
    } else {
      state[progressKey] =
        Number(state[progressKey] || 0) + criticalChance;
      triggered =
        state[progressKey] >= 1 &&
        Number(state[readyKey] || 0) <= event.at;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state[progressKey] -= 1;
      }
      state[readyKey] = event.at + 10;
      applyCondition(details, context, event, {
        name: "Incendiary Powder",
        condition: "Burning",
        stacks: 1,
        duration: 8,
        sourceId: TRAIT.INCENDIARY_POWDER,
        actorType: event.actorType === "summon" ? "summon" : "effect",
        metadata: event.actorType === "summon"
          ? { engineerMech: true }
          : {},
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
      coefficient: orbital ? 1.92 : 1,
      sourceId: orbital
        ? "engineer.orbital-command-strike"
        : TRAIT.AIM_ASSISTED_ROCKET,
      actorType: "effect",
      at: event.at + (orbital ? 2 : 0.04),
      explosion: !orbital,
      blastFinisher: orbital,
    });
    recordTrait(
      context,
      orbital ? "Orbital Command Strike" : "Aim-Assisted Rocket",
      event,
    );
  }

  triggerMassMomentum(context, event);
}

function reactToEngineerCondition(context, event) {
  if (
    event.condition === "Burning" &&
    event.actorType !== "summon"
    && hasTrait(context, TRAIT.THERMAL_VISION)
  ) {
    const state = engineerState(context);
    state.traitProcReadyAt.thermalVisionUntil = Math.max(
      Number(state.traitProcReadyAt.thermalVisionUntil || 0),
      event.at + 4,
    );
  }
  if (
    event.condition === "Bleeding" &&
    event.actorType !== "summon"
    && hasTrait(context, TRAIT.SANGUINE_ARRAY)
  ) {
    queueBuff(context, event, {
      name: "Sanguine Array",
      kind: "might",
      stacks: Math.max(1, Number(event.stacks || 1)),
      duration: 4,
      sourceId: TRAIT.SANGUINE_ARRAY,
      actorType: "effect",
    });
    recordTrait(context, "Sanguine Array", event);
  }
  if (
    event.condition === "Bleeding"
    && event.actorType !== "summon"
    && hasTrait(context, TRAIT.HEMATIC_FOCUS)
  ) {
    const state = procState(context);
    if (Number(state.hematicFocus || 0) <= event.at) {
      state.hematicFocus = event.at + 8;
      queueBuff(context, event, {
        name: "Hematic Focus",
        kind: "fury",
        stacks: 1,
        duration: 8,
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: "effect",
      });
      recordTrait(context, "Hematic Focus", event);
    }
  }
}

function reactToEngineerBuff(context, event) {
  const kind = String(event.kind || "").toLowerCase();
  if (
    kind === "might"
    && hasTrait(context, TRAIT.APPLIED_FORCE)
    && activeBoonStacks(context, "might", 25, event.at) >= 10
  ) {
    const state = procState(context);
    if (Number(state.appliedForce || 0) <= event.at) {
      state.appliedForce = event.at + 10;
      queueBuff(context, event, {
        name: "Applied Force",
        kind: "stability",
        stacks: 1,
        duration: 3,
        sourceId: TRAIT.APPLIED_FORCE,
        actorType: "effect",
      });
      recordTrait(context, "Applied Force", event);
    }
  }
  if (kind === "stability") triggerMassMomentum(context, event);
}

function handleRadiantArcQuickness(context, event) {
  const heat = Number(engineerState(context).heat || 0);
  const enhancedCapacityTier =
    heat >= 100
    && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  queueBuff(context, event, {
    name: "Radiant Arc — quickness",
    kind: "quickness",
    stacks: 1,
    duration: enhancedCapacityTier ? 6 : heat > 50 ? 4 : 2,
  });
}

function handlePrimeLightBeamField(context, event) {
  const heat = Number(engineerState(context).heat || 0);
  if (heat <= 50) return;
  const enhancedCapacityTier =
    heat >= 100
    && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  for (let pulse = 0; pulse < 10; pulse += 1) {
    const at = event.at + pulse;
    enqueueOrdered(context.queue, {
      type: "damage",
      at,
      name: "Field Damage",
      skillName: event.skillName,
      coefficient: 0.5,
      hits: 1,
      hitIndex: pulse + 1,
      totalHits: 10,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
      skillWeapon: "Unequipped",
      damageKind: "explosion",
      enhancedCapacityTier,
    });
    enqueueOrdered(context.queue, {
      type: "condition",
      at,
      name: `${event.skillName} â€” Burning`,
      skillName: event.skillName,
      condition: "Burning",
      stacks: 1,
      duration: 3,
      applicationIndex: pulse + 1,
      totalApplications: 10,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
      enhancedCapacityTier,
    });
  }
}

function handleLaserDisk(context, event) {
  const state = engineerState(context);
  const heat = Number(state.heat || 0);
  const pulses = heat > 50 ? 18 : 12;
  const enhancedCapacityTier =
    heat >= 100
    && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const at = event.at + (pulse + 1) * 0.52;
    enqueueOrdered(context.queue, {
      type: "damage",
      at,
      name: "Laser Disk",
      skillName: event.skillName,
      coefficient: 0.5,
      hits: 1,
      hitIndex: pulse + 1,
      totalHits: pulses,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
      skillWeapon: "Utility",
      enhancedCapacityTier,
    });
    enqueueOrdered(context.queue, {
      type: "condition",
      at,
      name: `${event.skillName} - Bleeding`,
      skillName: event.skillName,
      condition: "Bleeding",
      stacks: 1,
      duration: 2,
      applicationIndex: pulse + 1,
      totalApplications: pulses,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
    });
  }
}

function handleLaunchWall(context, event) {
  const heat = Number(engineerState(context).heat || 0);
  const walls = heat > 50 ? 3 : 1;
  const enhancedCapacityTier =
    heat >= 100
    && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  const at = event.at + 0.48;
  for (let wall = 0; wall < walls; wall += 1) {
    enqueueOrdered(context.queue, {
      type: "damage",
      at,
      name: "Launch Wall",
      skillName: event.skillName,
      coefficient: 1.5,
      hits: 1,
      hitIndex: wall + 1,
      totalHits: walls,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
      skillWeapon: "Utility",
      damageKind: "explosion",
      enhancedCapacityTier,
    });
    enqueueOrdered(context.queue, {
      type: "condition",
      at,
      name: `${event.skillName} - Vulnerability`,
      skillName: event.skillName,
      condition: "Vulnerability",
      stacks: 3,
      duration: 5,
      applicationIndex: wall + 1,
      totalApplications: walls,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
    });
  }
}

function handleRefractionCutterExtraBlades(context, event) {
  const state = engineerState(context);
  const heat = Number(state.heat || 0);
  const extraBlades =
    heat >= 100
    && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
      ? 4
      : heat > 50
        ? 2
        : 0;
  for (let blade = 0; blade < extraBlades; blade += 1) {
    const at = event.at + 0.36;
    enqueueOrdered(context.queue, {
      type: "damage",
      at,
      name: "Refraction Cutter Blade",
      skillName: event.skillName,
      coefficient: 0.4,
      hits: 1,
      hitIndex: blade + 2,
      totalHits: extraBlades + 1,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
      skillWeapon: "Sword",
      projectile: true,
      finisherType: "Projectile",
      finisherValue: 0.2,
    });
    enqueueOrdered(context.queue, {
      type: "condition",
      at,
      name: `${event.skillName} - Bleeding`,
      skillName: event.skillName,
      condition: "Bleeding",
      stacks: 1,
      duration: 4,
      applicationIndex: blade + 2,
      totalApplications: extraBlades + 1,
      source: "engineer",
      sourceId: event.skillId,
      actorType: "player",
      skillId: event.skillId,
    });
  }
}

export const engineerResolverEventHandlers = Object.freeze({
  "engineer.state": handleEngineerState,
  "engineer.combo-field": handleEngineerComboField,
  "engineer.dodge": handleEngineerDodge,
  "engineer.mass-momentum-pulse": handleMassMomentumPulse,
  "engineer.lightning-rod-pulse": handleLightningRodPulse,
  "engineer.conduit-surge": handleConduitSurge,
  "engineer.electric-artillery": handleElectricArtillery,
  "engineer.radiant-arc-quickness": handleRadiantArcQuickness,
  "engineer.prime-light-beam-field": handlePrimeLightBeamField,
  "engineer.laser-disk": handleLaserDisk,
  "engineer.launch-wall": handleLaunchWall,
  "engineer.refraction-cutter-extra-blades":
    handleRefractionCutterExtraBlades,
});

export const engineerResolverEventReactions = Object.freeze({
  damage: reactToEngineerDamage,
  condition: reactToEngineerCondition,
  buff: reactToEngineerBuff,
});
