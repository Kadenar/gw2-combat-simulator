import { amalgamState } from "./state.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../core/state.js";
import { emitEngineerState } from "../../core/events.js";
import { AMALGAM_NEW_GENES_BOONS } from "./mechanics.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill,
} from "../../types.js";

interface AmalgamBuff {
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly sourceId: SkillId;
  readonly name: string;
}

interface AmalgamControl {
  readonly name: string;
  readonly controlKind: string;
  readonly duration: number;
  readonly sourceId: SkillId;
}

interface MercurialTendenciesPayload extends SchedulerRecord {
  readonly sourceSkill?: string;
}

function emitBuff(
  context: EngineerSchedulerContext,
  at: number,
  { kind, duration, stacks = 1, sourceId, name }: AmalgamBuff,
): void {
  context.emit({
    type: "buff",
    at,
    source: "engineer",
    sourceId,
    actorType: "player",
    skillName: name,
    name,
    kind,
    duration,
    stacks,
  });
}

function emitControl(
  context: EngineerSchedulerContext,
  at: number,
  { name, controlKind, duration, sourceId }: AmalgamControl,
): void {
  context.emit({
    type: "control",
    at,
    source: "engineer",
    sourceId,
    actorType: "player",
    skillName: name,
    name,
    controlKind,
    duration,
  });
}

function selectedMorphNames(context: EngineerSchedulerContext): Set<string> {
  return new Set(
    amalgamState
      .from(context)
      .selectedMorphSkillIds.map(
        (id) => context.catalog.skillsById.get(Number(id))?.name,
      )
      .filter((name): name is string => Boolean(name)),
  );
}

function applyAmalgamStrain(
  context: EngineerSchedulerContext,
  morphName: string,
  at: number,
): void {
  const state = amalgamState.from(context);
  if (morphName === "Defensive Protocol: Protect") {
    emitBuff(context, at, {
      kind: "resistance",
      duration: 8,
      sourceId: "engineer.resiliant-strain",
      name: "Resiliant Strain",
    });
  } else if (morphName === "Defensive Protocol: Cleanse") {
    emitBuff(context, at, {
      kind: "alacrity",
      duration: 8,
      sourceId: "engineer.replicating-strain",
      name: "Replicating Strain",
    });
  } else if (morphName === "Defensive Protocol: Thorns") {
    state.rapaciousUntil = Math.max(Number(state.rapaciousUntil || 0), at + 8);
  } else if (morphName === "Offensive Protocol: Pierce") {
    emitControl(context, at, {
      name: "Volatile Strain",
      controlKind: "stun",
      duration: 2,
      sourceId: "engineer.volatile-strain",
    });
  } else if (morphName === "Offensive Protocol: Obliterate") {
    state.titanicUntil = Math.max(Number(state.titanicUntil || 0), at + 8);
    emitBuff(context, at, {
      kind: "might",
      duration: 8,
      stacks: 10,
      sourceId: "engineer.titanic-strain",
      name: "Titanic Strain",
    });
  } else if (morphName === "Offensive Protocol: Shred") {
    state.predatorUntil = Math.max(Number(state.predatorUntil || 0), at + 8);
    emitBuff(context, at, {
      kind: "quickness",
      duration: 8,
      sourceId: "engineer.predator-strain",
      name: "Predator Strain",
    });
    emitBuff(context, at, {
      kind: "superspeed",
      duration: 8,
      sourceId: "engineer.predator-strain",
      name: "Predator Strain",
    });
  } else if (morphName === "Offensive Protocol: Demolish") {
    state.berserkerUntil = Math.max(Number(state.berserkerUntil || 0), at + 8);
    emitBuff(context, at, {
      kind: "stability",
      duration: 8,
      stacks: 5,
      sourceId: "engineer.berserker-strain",
      name: "Berserker Strain",
    });
  }
}

function assumesDamagingField(context: EngineerSchedulerContext): boolean {
  return Boolean(
    context.config.professionAssumptions?.inDamagingField ??
    context.config.assumptions?.inDamagingField ??
    context.config.inDamagingField ??
    false,
  );
}

function scheduleThornsRetaliation(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
  if (!assumesDamagingField(context)) return;
  for (let index = 0; index < 6; index += 1) {
    context.emit({
      type: "damage",
      at: at + index,
      source: "engineer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Thorns Retaliation",
      coefficient: 0.5,
      hits: 1,
      hitIndex: index + 1,
      totalHits: 6,
      skillWeapon: "Unequipped",
      ...(index === 5 ? { extendsResolutionHorizon: true } : {}),
    });
  }
}

export function activateAmalgamMorph(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const at = context.effectiveEnd;
  const state = amalgamState.from(context);
  if (skill.name === "Defensive Protocol: Thorns") {
    state.thornsUntil = Math.max(state.thornsUntil, at + 6);
    scheduleThornsRetaliation(context, skill, at);
  }
  if (hasEngineerTrait(context.config, TRAIT.WILLING_HOST)) {
    state.willingHostUntil = Math.max(state.willingHostUntil, at + 10);
  }
  if (hasEngineerTrait(context.config, TRAIT.HARDENED_CHROME)) {
    emitBuff(context, at, {
      kind: "protection",
      duration: 2.5,
      sourceId: TRAIT.HARDENED_CHROME,
      name: "Hardened Chrome",
    });
  }
  if (hasEngineerTrait(context.config, TRAIT.SILVER_LINING)) {
    applyAmalgamStrain(context, skill.name, at);
  }
  if (hasEngineerTrait(context.config, TRAIT.NEW_GENES)) {
    emitBuff(context, at, {
      kind: "alacrity",
      duration: 5,
      sourceId: TRAIT.NEW_GENES,
      name: "New Genes",
    });
    emitBuff(context, at, {
      kind: "might",
      duration: 12,
      stacks: 4,
      sourceId: TRAIT.NEW_GENES,
      name: "New Genes",
    });
    const extra = AMALGAM_NEW_GENES_BOONS[skill.name];
    if (extra) {
      emitBuff(context, at, {
        ...extra,
        sourceId: TRAIT.NEW_GENES,
        name: "New Genes",
      });
    }
  }
  emitEngineerState(context, at, "amalgam-morph");
}

export function activatePlasmaticState(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  const at = context.start + castDuration * (640 / 720);
  const aftercastMs = context.hasBuff("quickness", context.start)
    ? skill.quicknessAftercastMs
    : skill.aftercastMs;
  amalgamState.from(context).plasmaticLockoutUntil =
    context.effectiveEnd + Math.max(0, Number(aftercastMs || 0)) / 1000;
  amalgamState.from(context).plasmaticStateUntil = Math.max(
    amalgamState.from(context).plasmaticStateUntil,
    at + 6,
  );
  emitEngineerState(context, at, "plasmatic-state");
}

export function evolveAmalgam(context: EngineerCastContext): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  // EVTC applies Evolved and all three strain buffs roughly 520 ms into the
  // measured 640 ms Quickness animation.
  const at = context.start + castDuration * (520 / 640);
  const state = amalgamState.from(context);
  const selected = selectedMorphNames(context);
  state.evolvedUntil = at + 8;

  if (!hasEngineerTrait(context.config, TRAIT.SILVER_LINING)) {
    for (const morphName of selected) {
      applyAmalgamStrain(context, morphName, at);
    }
  }
  if (hasEngineerTrait(context.config, TRAIT.SYMBIOTIC_SYNERGY)) {
    // Evolve recharges its morph skills as part of its traited kit. This is not
    // a discrete trait proc, so the reset is applied silently. Emitting a proc
    // here misreported it as a single ~43s cooldown reduction (the summed
    // remaining recharge of the three morphs) attributed to Evolve.
    for (const skillId of state.selectedMorphSkillIds) {
      context.state.cooldowns.delete(Number(skillId));
    }
  }
  if (hasEngineerTrait(context.config, TRAIT.HARDENED_CHROME)) {
    emitBuff(context, at, {
      kind: "protection",
      duration: 4,
      sourceId: TRAIT.HARDENED_CHROME,
      name: "Hardened Chrome",
    });
  }
  emitEngineerState(context, at, "evolve");
}

export function observeAmalgamScheduledEvent(
  context: EngineerSchedulerContext,
  event: EngineerSimulationEvent,
): void {
  if (
    context.config.specialization !== "Amalgam" ||
    !hasEngineerTrait(context.config, TRAIT.MERCURIAL_TENDENCIES) ||
    event.type !== "control" ||
    event.actorType === "summon"
  )
    return;
  context.tasks.schedule({
    type: "engineer.mercurial-tendencies",
    at: event.at,
    ownerId: "engineer.mercurial-tendencies",
    payload: {
      sourceSkill: event.skillName || event.name || "",
    },
  });
}

export function handleMercurialTendencies(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<MercurialTendenciesPayload>,
): void {
  const at = task.at;
  const coreState = professionCoreState(context);
  const readyAt = Number(coreState.traitProcReadyAt.mercurialTendencies || 0);
  if (readyAt > at + context.epsilon) return;

  let reducedBy = 0;
  const trackedIds = new Set([
    ...context.state.cooldowns.keys(),
    ...context.state.ammo.keys(),
  ]);
  for (const skillId of trackedIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill?.name !== "Evolve") continue;
    if (context.state.ammo.has(skillId)) {
      reducedBy += context.cooldownController.reduceAmmoRecharge(
        skill,
        2.5,
        at,
      ).reducedBy;
      continue;
    }
    const cooldown = Number(context.state.cooldowns.get(skillId) || 0);
    if (cooldown <= at + context.epsilon) continue;
    const reduction = Math.min(2.5, cooldown - at);
    context.state.cooldowns.set(skillId, cooldown - reduction);
    reducedBy += reduction;
  }
  if (!(reducedBy > 0)) return;

  coreState.traitProcReadyAt.mercurialTendencies = at + 0.25;
  context.emit({
    type: "proc",
    at,
    source: "Trait",
    sourceId: TRAIT.MERCURIAL_TENDENCIES,
    actorType: "effect",
    name: "Mercurial Tendencies",
    procType: "trait",
    sourceSkill: task.payload?.sourceSkill || "",
    cooldownReduction: reducedBy,
  });
}
