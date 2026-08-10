import { professionCoreState } from "../../../platform/engine/profession.js";
/** Core Ranger resolver-phase reactions and event handlers. */
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type {
  RangerResolverContext,
  RangerResolverEvent,
  RangerSkill,
} from "../types.js";

function eventSkill(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): RangerSkill | undefined {
  return event.skillId == null
    ? undefined
    : (context.helpers.skillsById?.get(event.skillId) as
        RangerSkill | undefined);
}

function queueBleeding(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  duration: number,
  sourceId: number,
  name: string,
): void {
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name: `${name} — Bleeding`,
    condition: "Bleeding",
    duration,
    stacks: 1,
    triggeredBy: event.skillName,
  });
}

function queueCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  condition: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string,
): void {
  const petSource = isPetStrike(event);
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: petSource ? "ranger-pet" : "Trait",
    sourceId,
    actorType: petSource ? "summon" : "effect",
    skillId: sourceId,
    skillName: name,
    name: `${name} - ${condition}`,
    condition,
    duration,
    stacks,
    triggeredBy: event.skillName,
  });
}

function rangerBoonDuration(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  kind: string,
  baseDuration: number,
): number {
  const name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  const stats = context.query.statsAt(event.at, event, context);
  const sigil = context.query.activeSigilSetAt(event.at);
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(context.config.stats?.boonDurationBonus || 0) / 100 +
    Number(context.config.stats?.boonDurationBonuses?.[name] || 0) / 100 +
    Number(sigil?.boonDurationBonus || 0) / 100;
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function isPetStrike(event: RangerResolverEvent): boolean {
  return event.actorType === "summon" && event.source === "ranger-pet";
}

function isPlayerStrike(event: RangerResolverEvent): boolean {
  return event.actorType === "player";
}

function beastmodeActive(context: RangerResolverContext): boolean {
  return Boolean(
    context.profession.specialization.kind === "Soulbeast" &&
    context.profession.specialization.state.beastmodeActive,
  );
}

function targetHealthFraction(context: RangerResolverContext): number {
  const maximum = Number(context.config.target?.health || 0);
  if (!(maximum > 0)) return 1;
  return Math.max(
    0,
    1 -
      (Number(context.totals.strike || 0) +
        Number(context.totals.condition || 0)) /
        maximum,
  );
}

function consumeOpeningStrike(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!hasTrait(context, TRAIT.OPENING_STRIKE)) return;
  const state = professionCoreState(context);
  const player = isPlayerStrike(event);
  const pet = isPetStrike(event);
  if ((!player && !pet) || !(Number(event.coefficient) > 0)) return;
  const ready = player
    ? state.playerOpeningStrikeReady
    : state.petOpeningStrikeReady;
  if (!ready) return;
  if (player) state.playerOpeningStrikeReady = false;
  else state.petOpeningStrikeReady = false;
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.OPENING_STRIKE,
    actorType: "effect",
    skillId: TRAIT.OPENING_STRIKE,
    skillName: "Opening Strike",
    name: "Opening Strike - Vulnerability",
    condition: "Vulnerability",
    duration: 5,
    stacks: 5,
    triggeredBy: event.skillName,
  });
  if (hasTrait(context, TRAIT.ALPHA_FOCUS)) {
    queueCondition(
      context,
      event,
      "Crippled",
      2,
      1,
      TRAIT.ALPHA_FOCUS,
      "Alpha Focus",
    );
  }
}

function triggerHuntersGaze(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!isPlayerStrike(event) || !hasTrait(context, TRAIT.HUNTERS_GAZE)) return;
  const state = professionCoreState(context);
  if (event.at < state.huntersGazeReadyAt) return;
  const health = targetHealthFraction(context);
  const stacks = health < 0.25 ? 3 : health < 0.5 ? 2 : health < 0.75 ? 1 : 0;
  if (!stacks) return;
  state.huntersGazeReadyAt = event.at + 1;
  context.recordProc(
    "trait",
    "Hunter's Gaze",
    event.at,
    event.skillName,
    `${stacks} might`,
    context.helpers.skillsById?.get(TRAIT.HUNTERS_GAZE)?.icon || "",
  );
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.HUNTERS_GAZE,
    actorType: "effect",
    skillId: TRAIT.HUNTERS_GAZE,
    skillName: "Hunter's Gaze",
    name: "Hunter's Gaze - Might",
    kind: "might",
    duration: rangerBoonDuration(context, event, "might", 5),
    stacks,
    triggeredBy: event.skillName,
  });
}

function triggerPoisonMaster(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  if (
    !state.poisonMasterPetAttackReady ||
    !isPetStrike(event) ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  state.poisonMasterPetAttackReady = false;
  queueCondition(
    context,
    event,
    "Poisoned",
    8,
    2,
    TRAIT.POISON_MASTER,
    "Poison Master",
  );
}

function triggerArachnophobia(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (
    !isPetStrike(event) ||
    !hasTrait(context, TRAIT.ARACHNOPHOBIA) ||
    (event.skillId !== ID.SPIT && event.skillId !== ID.TWIN_DARTS)
  ) {
    return;
  }
  queueCondition(
    context,
    event,
    "Torment",
    3,
    1,
    TRAIT.ARACHNOPHOBIA,
    "Arachnophobia",
  );
}

export const rangerCoreCriticalReactions = Object.freeze({
  id: "ranger.sharpened-edges",
  order: 20,
  chanceOnCriticalHit: 0.33,
  actorTypes: ["player", "summon"] as const,
  when(context: RangerResolverContext, event: RangerResolverEvent): boolean {
    return (
      hasTrait(context, TRAIT.SHARPENED_EDGES) &&
      (event.actorType === "player" || event.source === "ranger-pet")
    );
  },
  expectedProgress: {
    get(context: RangerResolverContext): number {
      return professionCoreState(context).sharpenedEdgesProgress;
    },
    set(context: RangerResolverContext, value: number): void {
      professionCoreState(context).sharpenedEdgesProgress = value;
    },
  },
  attribution: {
    kind: "trait" as const,
    id: TRAIT.SHARPENED_EDGES,
  },
  handler(context: RangerResolverContext, event: RangerResolverEvent): void {
    queueBleeding(context, event, 3, TRAIT.SHARPENED_EDGES, "Sharpened Edges");
  },
});

export function handleRangerBloodThirst(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  professionCoreState(context).bloodThirstCharges = Math.max(
    0,
    Number(event.charges || 0),
  );
}

export function handleRangerWinterBiteReady(
  context: RangerResolverContext,
  _event: RangerResolverEvent,
): void {
  professionCoreState(context).winterBiteReady = true;
}

export function handleRangerBeastSkillUsed(
  context: RangerResolverContext,
  _event: RangerResolverEvent,
): void {
  if (hasTrait(context, TRAIT.POISON_MASTER) && !beastmodeActive(context)) {
    professionCoreState(context).poisonMasterPetAttackReady = true;
  }
}

export const rangerCoreEventHandlers = Object.freeze({
  "ranger.blood-thirst": handleRangerBloodThirst,
  "ranger.winter-bite-ready": handleRangerWinterBiteReady,
  "ranger.beast-skill-used": handleRangerBeastSkillUsed,
});

export function reactToRangerCoreDamage(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!(Number(event.coefficient) > 0) || event.actorType === "effect") return;
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  consumeOpeningStrike(context, event);
  triggerHuntersGaze(context, event);
  triggerPoisonMaster(context, event);
  triggerArachnophobia(context, event);
  if (
    skill?.categories?.includes("Trap") &&
    event.activationId &&
    !state.trapCrippleActivations[event.activationId] &&
    hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)
  ) {
    state.trapCrippleActivations[event.activationId] = true;
    enqueueOrdered(context.queue, {
      type: "condition",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.TRAPPERS_EXPERTISE,
      actorType: "effect",
      skillId: TRAIT.TRAPPERS_EXPERTISE,
      skillName: "Trapper's Expertise",
      name: "Trapper's Expertise — Crippled",
      condition: "Crippled",
      duration: 3,
      stacks: 1,
      fixedDuration: true,
      triggeredBy: event.skillName,
    });
  }
  if (state.bloodThirstCharges > 0 && event.sourceId !== ID.CRIPPLING_SHOT) {
    state.bloodThirstCharges -= 1;
    queueBleeding(context, event, 12, ID.CRIPPLING_SHOT, "Blood Thirst");
  }
  if (
    skill?.id === ID.CONCUSSION_SHOT &&
    hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) &&
    (context.config?.target?.defiant ||
      context.config?.target?.flanking ||
      context.config?.target?.behind)
  ) {
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
      actorType: "effect",
      skillId: TRAIT.LIGHT_ON_YOUR_FEET,
      skillName: "Light on your Feet",
      name: "Light on your Feet — Vulnerability",
      kind: "target-vulnerability",
      duration: 1,
      stacks: 10,
      triggeredBy: event.skillName,
    });
  }
}

export function reactToRangerCoreControl(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, TRAIT.CARNIVORE) ||
    (!isPlayerStrike(event) && !isPetStrike(event)) ||
    event.at < state.carnivoreReadyAt
  ) {
    return;
  }
  state.carnivoreReadyAt = event.at + 0.25;
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.CARNIVORE,
    actorType: "effect",
    skillId: TRAIT.CARNIVORE,
    skillName: "Carnivore",
    name: "Carnivore",
    coefficient: 0.05,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    canCrit: false,
    damageKind: "life-steal",
    triggeredBy: event.skillName,
  });
}

export function reactToRangerCoreBuff(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const kind = String(event.kind || "").toLowerCase();
  const affectsSelf = event.affectsSelf !== false;
  if (kind === "fury" && affectsSelf && hasTrait(context, TRAIT.REMORSELESS)) {
    const state = professionCoreState(context);
    state.playerOpeningStrikeReady = true;
    state.petOpeningStrikeReady = true;
  }
}
