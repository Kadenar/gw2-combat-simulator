import {
  professionCoreState,
  professionSpecializationState,
} from "../../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { isInternalCooldownReady } from "../../../../platform/engine/internal-cooldown.js";
import { gw2AlliedPlayerProcTimeline } from "../../../../platform/gw2/allied-players.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../../data/ids.js";
import { emitGuardianEvent } from "../../core/events.js";
import {
  emitGuardianBuff,
  emitGuardianProc,
  guardianTraitIcon,
  hasGuardianTrait,
} from "../../core/traits.js";
import { reactToJusticeHitWithOptions } from "../../core/virtues.js";
import { FIREBRAND_MECHANICS } from "./mechanics.js";
import type { Gw2ConditionResolution } from "../../../../platform/gw2/types.js";
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue,
} from "../../types.js";

const DORMANT_DURATION: Readonly<Record<GuardianVirtue, number>> =
  Object.freeze({
    justice: 20,
    resolve: 30,
    courage: 45,
  });

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  if (!/^Tome of /.test(skill.name)) return null;
  const slot = Number(String(skill.slot || "").match(/(\d)$/)?.[1] || 0);
  return (
    ([null, "justice", "resolve", "courage"] as const)[slot] || null
  );
}

function isFinalMantraCharge(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  if (/^Final Charge\./.test(String(skill.description || ""))) return true;
  return (
    skill.categories?.includes("Mantra") === true &&
    Number(context.ammo?.charges || 0) === 1
  );
}

export function updateFirebrandCastState(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  const at = context.effectiveEnd;
  const state = professionSpecializationState(context, "Firebrand");
  const coreState = professionCoreState(context);
  const virtue = virtueFor(skill);
  if (virtue) {
    state.activeTome = virtue;
    if (state.swiftScholarTome !== virtue) {
      state.swiftScholarTome = virtue;
      state.swiftScholarCount = 0;
    }
    const passiveReadyAt = at + DORMANT_DURATION[virtue];
    coreState.virtueReadyAt[virtue] = passiveReadyAt;
    emitGuardianEvent(context, skill, "guardian.firebrand-virtue-activated", {
      virtue,
      passiveReadyAt,
    });
    if (coreState.lastVirtuePassiveWasReady) {
      emitGuardianBuff(context, skill, at, "quickness", 3);
      emitGuardianProc(context, {
        name: "Swift Scholar",
        at,
        sourceSkill: skill.name,
        detail: "3 seconds of quickness",
        icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.SWIFT_SCHOLAR),
      });
    }
  }
  if (
    skill.type === "Heal" &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.LIBERATORS_VOW) &&
    isInternalCooldownReady(at, state.liberatorsVowReadyAt)
  ) {
    state.liberatorsVowReadyAt = at + 7;
    emitGuardianBuff(context, skill, at, "quickness", 2, {
      recipients: "party",
    });
    emitGuardianProc(context, {
      name: "Liberator's Vow",
      at,
      sourceSkill: skill.name,
      detail: "2 seconds of quickness",
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.LIBERATORS_VOW),
    });
  }
  if (
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS) &&
    isFinalMantraCharge(context, skill)
  ) {
    state.tomePages = Math.min(
      state.maximumTomePages,
      state.tomePages + 2,
    );
    if (state.tomePages >= state.maximumTomePages) {
      state.nextTomePageAt = Number.POSITIVE_INFINITY;
    }
    context.emit({
      type: "condition",
      at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Weighty Terms — Slow",
      condition: "Slow",
      stacks: 1,
      duration: 1.5,
    });
    emitGuardianProc(context, {
      name: "Weighty Terms",
      at,
      sourceSkill: skill.name,
      detail: "Slow and +2 tome pages",
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS),
    });
  }
}

export function observeFirebrandScheduledEvent(
  context: GuardianSchedulerContext,
  event: GuardianResolverEvent,
): void {
  const kind = String(event.kind || "").toLowerCase();
  const state = professionSpecializationState(context, "Firebrand");
  if (
    event.type === "buff" &&
    ["aegis", "stability"].includes(kind) &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.STALWART_SPEED) &&
    isInternalCooldownReady(event.at, state.stalwartSpeedReadyAt)
  ) {
    state.stalwartSpeedReadyAt = event.at + 7;
    context.emit({
      type: "buff",
      at: event.at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      actorType: "player",
      skillId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      skillName: "Stalwart Speed",
      kind: "quickness",
      stacks: 1,
      duration: 2,
      triggeredBy: event.skillName,
    });
    emitGuardianProc(context, {
      name: "Stalwart Speed",
      at: event.at,
      sourceSkill: event.skillName || "Aegis or Stability",
      detail: "2 seconds of quickness",
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.STALWART_SPEED),
    });
    return;
  }
  const qualifyingStoicCondition =
    event.type === "condition" &&
    ["immobilized", "slow", "slowed"].includes(
      String(event.condition || "").toLowerCase(),
    );
  if (
    (event.type === "control" || qualifyingStoicCondition) &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR)
  ) {
    for (const buff of [
      { kind: "resistance", stacks: 1, duration: 2 },
      { kind: "might", stacks: 3, duration: 10 },
    ]) {
      context.emit({
        type: "buff",
        at: event.at,
        source: "guardian",
        sourceId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        actorType: "player",
        skillId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        skillName: "Stoic Demeanor",
        ...buff,
        triggeredBy: event.skillName,
      });
    }
    emitGuardianProc(context, {
      name: "Stoic Demeanor",
      at: event.at,
      sourceSkill: event.skillName || "Disable",
      detail: "2s resistance and 3 might",
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR),
    });
    return;
  }
  if (event.type !== "damage") return;
  const skill =
    event.skillId == null
      ? undefined
      : context.catalog.skillsById.get(event.skillId);
  if (
    skill?.weapon === "Axe" &&
    event.actorType === "player" &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.UNRELENTING_CRITICISM)
  ) {
    context.emit({
      type: "condition",
      at: event.at,
      source: "guardian",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Unrelenting Criticism — Bleeding",
      condition: "Bleeding",
      stacks: 1,
      duration: 4.5,
      triggeredBy: "Unrelenting Criticism",
      activationId: event.activationId,
    });
  }
}

export function handleFirebrandVirtueActivation(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const virtue = event.virtue;
  if (!virtue) return;
  professionSpecializationState(context, "Firebrand").activeTome = virtue;
  professionCoreState(context).virtueReadyAt[virtue] = Number(
    event.passiveReadyAt,
  );
}

export function reactToFirebrandJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: {
    readonly hitContext?: object;
    readonly applyCondition?: Gw2ConditionResolution["applyCondition"];
  } = {},
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE),
    skillId: GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
    skillName: "Tome of Justice",
  });
}

export function reactToFirebrandBuffTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const state = professionSpecializationState(context, "Firebrand");
  if (
    String(event.kind || "").toLowerCase() !== "quickness" ||
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE) ||
    !isInternalCooldownReady(event.at, state.quickfireReadyAt)
  ) {
    return;
  }
  state.quickfireReadyAt = event.at + 7;
  const hadAshes =
    state.ashesCharges > 0 &&
    event.at < state.ashesExpiresAt - Number(context.epsilon || 0.0001);
  state.ashesCharges = Math.max(0, Number(state.ashesCharges || 0)) + 1;
  state.ashesNextTriggerAt = hadAshes ? state.ashesNextTriggerAt : event.at;
  state.ashesExpiresAt = event.at + 10;
  enqueueOrdered(context.queue, {
    type: "guardian.ashes-expired",
    at: state.ashesExpiresAt,
    priority: 10,
    source: "guardian",
    sourceId: GUARDIAN_TRAIT_IDS.QUICKFIRE,
    actorType: "effect",
    skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
    skillName: "Quickfire",
    ashesExpiresAt: state.ashesExpiresAt,
  });
  for (const proc of gw2AlliedPlayerProcTimeline(context.config, {
    start: event.at,
    duration: 10,
    maximumPerAlly: 1,
    internalCooldown: 1,
  })) {
    enqueueOrdered(context.queue, {
      type: "condition",
      at: proc.at,
      priority: 5,
      source: "guardian",
      sourceId: "guardian.ashes-of-the-just",
      actorType: "player",
      skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
      skillName: "Quickfire",
      name: `Quickfire — Ally ${proc.allyIndex} Burning`,
      condition: FIREBRAND_MECHANICS.ashesBurn.condition,
      stacks: 1,
      duration: FIREBRAND_MECHANICS.ashesBurn.duration,
      triggeredByAlly: proc.allyIndex,
    });
  }
  context.recordProc(
    "trait",
    "Quickfire",
    event.at,
    event.skillName,
    "+1 Ashes of the Just",
    guardianTraitIcon(GUARDIAN_TRAIT_IDS.QUICKFIRE),
  );
}
