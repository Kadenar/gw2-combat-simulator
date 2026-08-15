import { professionCoreState } from "../../../platform/engine/profession.js";
/** Core Ranger resolver-phase reactions and event handlers. */
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { gw2StatsForWeaponSet } from "../../../platform/gw2/runtime-rules.js";
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
import { rangerPetCompanionId } from "./pets.js";
import { rangerPetByName } from "./state.js";

function eventSkill(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): RangerSkill | undefined {
  return event.skillId == null
    ? undefined
    : (context.helpers.skillsById?.get(event.skillId) as
        RangerSkill | undefined);
}

function petDerivedConditionMetadata(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): Record<string, unknown> {
  if (!isPetStrike(event)) return {};
  return {
    source: "ranger-pet",
    actorType: "summon",
    independentSummonStrike: event.independentSummonStrike,
    summonUsesProfessionModifiers: event.summonUsesProfessionModifiers,
    summonInheritsAttributes: event.summonInheritsAttributes,
    summonBasePower: event.summonBasePower,
    summonBasePrecision: event.summonBasePrecision,
    summonBaseFerocity: event.summonBaseFerocity,
    summonBaseConditionDamage: event.summonBaseConditionDamage,
    summonBaseExpertise: event.summonBaseExpertise,
    summonOwner: event.summonOwner ?? rangerPetCompanionId(context),
  };
}

function queueBleeding(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  duration: number,
  sourceId: number,
  name: string,
): void {
  const petSource = isPetStrike(event);
  enqueueOrdered(context.queue, {
    ...petDerivedConditionMetadata(context, event),
    type: "condition",
    at: event.at,
    source: petSource ? "ranger-pet" : "Trait",
    sourceId,
    actorType: petSource ? "summon" : "effect",
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
    ...petDerivedConditionMetadata(context, event),
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
  const configuredStats = gw2StatsForWeaponSet(
    context.config,
    context.activeWeaponSet,
  );
  const sigil = context.query.activeSigilSetAt(event.at);
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(configuredStats.boonDurationBonus || 0) / 100 +
    Number(configuredStats.boonDurationBonuses?.[name] || 0) / 100 +
    Number(sigil?.boonDurationBonus || 0) / 100;
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function isPetStrike(event: RangerResolverEvent): boolean {
  return event.source === "ranger-pet";
}

function isPlayerStrike(event: RangerResolverEvent): boolean {
  return event.actorType === "player" && !isPetStrike(event);
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
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.POISON_MASTER,
    actorType: "effect",
    skillId: TRAIT.POISON_MASTER,
    skillName: "Poison Master",
    name: "Poison Master - Poisoned",
    condition: "Poisoned",
    duration: 8,
    stacks: 2,
    triggeredBy: event.skillName,
  });
}

function triggerPoisonousStrikes(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  if (event.at > state.poisonousStrikesExpiresAt) {
    state.poisonousStrikesCharges = 0;
  }
  const merged = beastmodeActive(context);
  const eligibleStrike = merged ? isPlayerStrike(event) : isPetStrike(event);
  if (
    state.poisonousStrikesCharges <= 0 ||
    !eligibleStrike ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  state.poisonousStrikesCharges -= 1;
  const petSource = !merged;
  enqueueOrdered(context.queue, {
    ...(petSource ? petDerivedConditionMetadata(context, event) : {}),
    type: "condition",
    at: event.at,
    source: petSource ? "ranger-pet" : "ranger",
    sourceId: ID.DOUBLE_ARC,
    actorType: petSource ? "summon" : "effect",
    skillId: ID.DOUBLE_ARC,
    skillName: "Poisonous Strikes",
    name: "Poisonous Strikes - Poisoned",
    condition: "Poisoned",
    duration: 6,
    stacks: 1,
    triggeredBy: event.skillName,
  });
}

function triggerSharpeningStone(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  if (event.at > state.sharpeningStoneExpiresAt) {
    state.sharpeningStoneCharges = 0;
  }
  if (
    state.sharpeningStoneCharges <= 0 ||
    !isPlayerStrike(event) ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  state.sharpeningStoneCharges -= 1;
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "ranger",
    sourceId: ID.SHARPENING_STONE,
    actorType: "effect",
    skillId: ID.SHARPENING_STONE,
    skillName: "Sharpening Stone",
    name: "Sharpening Stone - Bleeding",
    condition: "Bleeding",
    duration: 8,
    stacks: 1,
    triggeredBy: event.skillName,
  });
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

function triggerStrengthOfThePack(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!isPlayerStrike(event)) return;
  const active = (context.boons.get("strength-of-the-pack") || []).some(
    (application) =>
      application.affectsSelf !== false &&
      application.at <= event.at &&
      application.expiresAt > event.at,
  );
  if (!active) return;
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "ranger",
    sourceId: ID.STRENGTH_OF_THE_PACK,
    actorType: "effect",
    skillId: ID.STRENGTH_OF_THE_PACK,
    skillName: '"Strength of the Pack!"',
    name: '"Strength of the Pack!" - Might',
    kind: "might",
    duration: 8,
    stacks: 1,
    affectsSelf: false,
    affectsSummons: true,
    maximumRecipients: 5,
    companionIds: [rangerPetCompanionId(context)],
    triggeredBy: event.skillName,
  });
}

function triggerGoForTheThroat(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  const beastSkillId = state.activePetSkillIds.at(-1);
  if (
    event.skillId !== beastSkillId ||
    !skill?.petSkill ||
    skill.petFamilySkill ||
    !hasTrait(context, TRAIT.GO_FOR_THE_THROAT) ||
    event.at < state.goForTheThroatPetReadyAt
  ) {
    return;
  }
  state.goForTheThroatPetReadyAt = event.at + 10;
  context.recordProc(
    "trait",
    'Lesser "Sic \'Em!"',
    event.at,
    event.skillName,
    "8s, +15% pet strike damage",
    context.helpers.skillsById?.get(ID.LESSER_SIC_EM)?.icon ||
      context.helpers.skillsById?.get(ID.SIC_EM)?.icon ||
      "",
  );
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    source: "Trait",
    sourceId: ID.LESSER_SIC_EM,
    actorType: "effect",
    skillId: ID.LESSER_SIC_EM,
    skillName: 'Lesser "Sic \'Em!"',
    name: 'Lesser "Sic \'Em!"',
    kind: "lesser-sic-em-pet",
    duration: 8,
    stacks: 1,
    affectsSelf: false,
    affectsSummons: true,
    maximumRecipients: 1,
    companionIds: [rangerPetCompanionId(context)],
    triggeredBy: event.skillName,
  });
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

export function handleRangerPoisonousStrikes(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  state.poisonousStrikesCharges = Math.max(0, Number(event.charges || 0));
  state.poisonousStrikesExpiresAt = event.at + Number(event.duration || 0);
}

export function handleRangerSharpeningStone(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  state.sharpeningStoneCharges = Math.max(0, Number(event.charges || 0));
  state.sharpeningStoneExpiresAt = event.at + Number(event.duration || 0);
}

export function handleRangerPetSwapped(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = professionCoreState(context);
  const outgoingCompanionId = rangerPetCompanionId(context);
  const removedAt = event.at + 1;
  for (const application of context.conditionApplications) {
    if (
      application.source === "ranger-pet" &&
      (!application.summonOwner ||
        String(application.summonOwner) === outgoingCompanionId) &&
      application.naturalExpiresAt > removedAt
    ) {
      application.removedAt = removedAt;
    }
  }
  for (const condition of context.conditionState.values()) {
    for (const stack of condition.stacks) {
      if (
        stack.application.source === "ranger-pet" &&
        (!stack.application.summonOwner ||
          String(stack.application.summonOwner) === outgoingCompanionId)
      ) {
        stack.expiresAt = Math.min(stack.expiresAt, removedAt);
      }
    }
  }
  state.petAutoGeneration += 1;
  const pet = rangerPetByName(String(event.activePet || ""));
  state.activePet = pet.name;
  state.activePetSlot = Number(event.activePetSlot) === 2 ? 2 : 1;
  state.activePetSkillIds = [...pet.skillIds];
  state.petOpeningStrikeReady = true;
  if (context.profession.specialization.kind === "Soulbeast") {
    context.profession.specialization.state.archetype = pet.archetype;
  }
}

export const rangerCoreEventHandlers = Object.freeze({
  "ranger.blood-thirst": handleRangerBloodThirst,
  "ranger.winter-bite-ready": handleRangerWinterBiteReady,
  "ranger.beast-skill-used": handleRangerBeastSkillUsed,
  "ranger.poisonous-strikes": handleRangerPoisonousStrikes,
  "ranger.sharpening-stone": handleRangerSharpeningStone,
  "ranger.pet-swapped": handleRangerPetSwapped,
});

export function reactToRangerCoreDamage(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!(Number(event.coefficient) > 0) || event.actorType === "effect") return;
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  consumeOpeningStrike(context, event);
  // The Beast skill's strike resolves before Lesser Sic 'Em is applied, so
  // the triggering hit cannot benefit from the buff it creates.
  if (!beastmodeActive(context)) triggerGoForTheThroat(context, event);
  triggerHuntersGaze(context, event);
  triggerPoisonMaster(context, event);
  triggerPoisonousStrikes(context, event);
  triggerSharpeningStone(context, event);
  triggerArachnophobia(context, event);
  triggerStrengthOfThePack(context, event);
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
