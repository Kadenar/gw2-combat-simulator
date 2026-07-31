import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type {
  SchedulerRecord,
  SimulationActorType,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  Gw2EventDraft,
} from "../../../platform/gw2/types.js";
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails,
  EngineerSkill,
  EngineerState,
} from "../types.js";

interface QueueDamageOptions {
  readonly name: string;
  readonly coefficient: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly at?: number;
  readonly noCrit?: boolean;
  readonly explosion?: boolean;
  readonly blastFinisher?: boolean;
  readonly weaponStrength?: number;
  readonly weaponStrengthProfileId?: string;
}

interface QueueBuffOptions {
  readonly name: string;
  readonly kind: string;
  readonly stacks: number;
  readonly duration: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
}

interface ApplyConditionOptions {
  readonly name: string;
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly metadata?: SchedulerRecord;
}

export function resolverSkill(
  context: EngineerResolverContext,
  skillId: SkillId | null | undefined,
): EngineerSkill | undefined {
  if (skillId == null) return;
  return context.helpers.skillsById?.get(skillId) as
    | EngineerSkill
    | undefined;
}

function handleEngineerState(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
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

export function queueDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
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
    weaponStrengthProfileId,
  }: QueueDamageOptions,
): void {
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
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
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
    ...(weaponStrengthProfileId == null
      ? {}
      : { weaponStrengthProfileId }),
    triggeredBy: event.skillName,
  });
}

function handleEngineerComboField(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
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

function hasActiveEngineerComboField(
  context: EngineerResolverContext,
  at: number,
): boolean {
  const state = engineerState(context);
  state.activeComboFields = (state.activeComboFields || [])
    .filter(field => Number(field.expiresAt || 0) >= at);
  return state.activeComboFields.some(field =>
    Number(field.startsAt || 0) <= at
    && Number(field.expiresAt || 0) >= at);
}

export function queueBuff(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  {
    name,
    kind,
    stacks,
    duration,
    sourceId = event.skillId,
    actorType = "player",
  }: QueueBuffOptions,
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    name,
    skillName: name,
    kind,
    stacks,
    duration,
    source: actorType === "effect" ? "Trait" : "engineer",
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    triggeredBy: event.skillName,
  });
}

export function applyCondition(
  details: EngineerResolverReactionDetails,
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  {
    name,
    condition,
    stacks,
    duration,
    sourceId = event.skillId,
    actorType = "player",
    metadata = {},
  }: ApplyConditionOptions,
): void {
  const application: Gw2EventDraft = {
    type: "condition",
    at: event.at,
    name: `${name} — ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: actorType === "effect" ? "Trait" : "engineer",
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
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

function focused(context: EngineerResolverContext, at: number): boolean {
  return Number(context.profession.focusedUntil || 0) > at;
}

export function engineerState(context: EngineerResolverContext): EngineerState {
  return context.state?.profession ?? context.profession;
}

function handleLightningRodPulse(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
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

function handleConduitSurge(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
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
    sourceId: event.skillId ?? event.sourceId,
    actorType: "player",
  });
}

function handleElectricArtillery(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
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
    sourceId: event.skillId ?? event.sourceId,
    actorType: "player",
  });
}

export function procState(
  context: EngineerResolverContext,
): Record<string, number | boolean> {
  const state = engineerState(context);
  state.traitProcReadyAt ||= {};
  return state.traitProcReadyAt;
}

function isExplosion(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): boolean {
  if (event.explosion || event.damageKind === "explosion") return true;
  const skill = resolverSkill(
    context,
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

function isAimAssistedProjectile(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): boolean {
  if (event.actorType !== "player") return false;
  if (event.projectile === true) return true;
  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.kit === "Grenade Kit" ||
    skill?.categories?.some(
      (category) => String(category).toLowerCase() === "projectile",
    )
  );
}

export function recordTrait(
  context: EngineerResolverContext,
  name: string,
  event: EngineerResolverEvent,
  icon = "",
): void {
  context.recordProc?.("trait", name, event.at, event.skillName, "", icon);
}

export function activeBoonStacks(
  context: EngineerResolverContext,
  kind: string,
  maximum = 25,
  at = 0,
): number {
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

function usesRandomTraitProcs(context: EngineerResolverContext): boolean {
  return context.random?.stochastic === true;
}

function rolledCritical(
  details: EngineerResolverReactionDetails,
): boolean {
  return details.hitContext?.critical?.didCrit === true;
}

function handleEngineerDodge(context: EngineerResolverContext): void {
  procState(context).explosiveEntranceFired = false;
}

function reactToEngineerDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  details: EngineerResolverReactionDetails = {},
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  const criticalChance = Number(
    details.hitContext?.critical?.chance ?? details.criticalChance ?? 0,
  );
  const skill = resolverSkill(context, event.skillId);
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
      } as unknown as EngineerResolverEvent);
    }
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
        state.shrapnelProgress = Number(state.shrapnelProgress || 0) - 1;
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
        state.serratedSteelProgress =
          Number(state.serratedSteelProgress || 0) - 1;
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
      if (!usesRandomTraitProcs(context)) {
        state.noScopeProgress = Number(state.noScopeProgress || 0) - 1;
      }
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
    event.actorType != null
    && ["player", "summon"].includes(event.actorType)
    &&
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
        state[progressKey] = Number(state[progressKey] || 0) - 1;
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
        ? ID.ORBITAL_COMMAND_STRIKE
        : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL,
      actorType: "effect",
      at: event.at + (orbital ? 2 : 0.04),
      explosion: !orbital,
      blastFinisher: orbital,
      weaponStrengthProfileId: "nonweapon.unequipped",
    });
    recordTrait(
      context,
      orbital ? "Orbital Command Strike" : "Aim-Assisted Rocket",
      event,
    );
  }

}

function reactToEngineerCondition(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
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
function handleRadiantArcQuickness(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  queueBuff(context, event, {
    name: "Radiant Arc — quickness",
    kind: "quickness",
    stacks: 1,
    duration: Math.max(0, Number(event.duration ?? 2)),
  });
}

function handleRefractionCutterExtraBlades(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  const extraBlades = Math.max(
    0,
    Math.trunc(Number(event.extraBlades || 0)),
  );
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
      sourceId: event.skillId ?? event.sourceId,
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
      sourceId: event.skillId ?? event.sourceId,
      actorType: "player",
      skillId: event.skillId,
    });
  }
}


export const engineerCoreResolverEventHandlers = Object.freeze({
  "engineer.state": handleEngineerState,
  "engineer.combo-field": handleEngineerComboField,
  "engineer.dodge": handleEngineerDodge,
  "engineer.lightning-rod-pulse": handleLightningRodPulse,
  "engineer.conduit-surge": handleConduitSurge,
  "engineer.electric-artillery": handleElectricArtillery,
  "engineer.radiant-arc-quickness": handleRadiantArcQuickness,
  "engineer.refraction-cutter-extra-blades":
    handleRefractionCutterExtraBlades,
});

export const engineerCoreResolverEventReactions = Object.freeze({
  damage: reactToEngineerDamage,
  condition: reactToEngineerCondition,
});
