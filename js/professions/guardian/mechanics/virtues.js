import { isGw2PlayerActorEvent } from "../../../platform/gw2/event-ownership.js";
import {
  GUARDIAN_SKILL_IDS,
  GUARDIAN_TRAIT_IDS,
} from "../data/ids.js";
import { selectedGuardianSpecialization } from "./availability.js";
import { emitGuardianEvent } from "./events.js";
import { GUARDIAN_HANDLER_MECHANICS } from "./skill-mechanics.js";

export const GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION = Object.freeze({
  Core: Object.freeze([
    "Virtue of Justice",
    "Virtue of Resolve",
    "Virtue of Courage",
  ]),
  Dragonhunter: Object.freeze([
    "Spear of Justice",
    "Wings of Resolve",
    "Shield of Courage",
  ]),
  Firebrand: Object.freeze([
    "Tome of Justice",
    "Tome of Resolve",
    "Tome of Courage",
  ]),
  Willbender: Object.freeze([
    "Rushing Justice",
    "Flowing Resolve",
    "Crashing Courage",
  ]),
  Luminary: Object.freeze([
    "Radiant Justice",
    "Radiant Resolve",
    "Radiant Courage",
  ]),
});

function hasTrait(context, traitId) {
  return context.traits?.has(traitId)
    || context.traits?.has(String(traitId));
}

export function validateVirtueCast(context, skill) {
  if (
    !skill.categories?.includes("Virtue")
    || !/^Profession_[1-3]$/.test(String(skill.slot || ""))
  ) return;
  const specialization =
    selectedGuardianSpecialization(context) || "Core";
  return GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION[specialization]
    ?.includes(skill.name) === true;
}

function activateVirtue(context, skill) {
  const slot = Number(String(skill.slot || "").match(/(\d)$/)?.[1] || 0);
  const virtue = ["", "justice", "resolve", "courage"][slot];
  if (!virtue) return false;
  if (/^Tome of /.test(skill.name)) {
    context.state.profession.activeTome = virtue;
  }
  emitGuardianEvent(context, skill, "guardian.virtue-activated", {
    virtue,
    specialization:
      skill.specialization
      || context.config.specialization
      || "Core",
    passiveReadyAt:
      context.rechargeReadyAt ?? context.effectiveEnd,
  });
  return false;
}

function renewedFocus(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  for (const virtue of context.catalog.skills.filter(candidate =>
    candidate.categories?.includes("Virtue")
    && /^Profession_[1-3]$/.test(String(candidate.slot || "")))) {
    context.state.cooldowns.delete(virtue.id);
  }
  emitGuardianEvent(context, skill, "guardian.virtues-refreshed");
  return true;
}

export const guardianVirtueSkillHandlers = Object.freeze({
  "guardian.virtue": activateVirtue,
  "guardian.renewed-focus": renewedFocus,
});

export function handleVirtueActivation(context, event) {
  context.state.profession.virtueReadyAt[event.virtue] =
    Number(event.passiveReadyAt || event.at);
  if (
    event.virtue === "justice"
    && (event.specialization === "Core" || !event.specialization)
  ) {
    context.state.profession.justiceActiveArmed = true;
    context.state.profession.justiceArmed = true;
  }
}

export function handleVirtueRefresh(context, event) {
  context.state.profession.virtueReadyAt = {
    justice: event.at,
    resolve: event.at,
    courage: event.at,
  };
}

function applyJusticeBurn(
  context,
  event,
  applyCondition,
  {
    active,
  },
) {
  const burn = GUARDIAN_HANDLER_MECHANICS.justiceBurn;
  const sourceId = active
    ? "guardian.justice-active"
    : "guardian.justice-passive";
  applyCondition(context, {
    type: "condition",
    at: event.at,
    source: "guardian",
    sourceId,
    actorType: "player",
    skillId: GUARDIAN_SKILL_IDS.JUSTICE,
    skillName: "Virtue of Justice",
    name: `Virtue of Justice — ${active ? "Active" : "Passive"} Burning`,
    condition: burn.condition,
    stacks: burn.stacks,
    duration: burn.duration,
  });
  context.state.profession.justiceBurns += 1;
  if (active) context.state.profession.justiceActiveBurns += 1;
  else context.state.profession.justicePassiveBurns += 1;
  context.recordProc(
    "profession",
    active ? "Justice Active" : "Justice Passive",
    event.at,
    event.skillName,
  );
}

export function reactToJusticeHit(
  context,
  event,
  {
    hitContext,
    applyCondition,
  } = {},
) {
  if (
    !hitContext
    || typeof applyCondition !== "function"
    || !isGw2PlayerActorEvent(event)
    || !(Number(event.coefficient) > 0)
  ) return;

  const state = context.state.profession;
  if (state.justiceActiveArmed) {
    state.justiceActiveArmed = false;
    state.justiceArmed = false;
    applyJusticeBurn(context, event, applyCondition, { active: true });
    return;
  }

  const retainsPassive = hasTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE);
  if (
    !retainsPassive
    && event.at < Number(state.virtueReadyAt.justice || 0)
  ) return;

  state.justiceHitCount += 1;
  const triggerHits = hasTrait(
    context,
    GUARDIAN_TRAIT_IDS.PERMEATING_WRATH,
  ) ? 3 : 5;
  if (state.justiceHitCount < triggerHits) return;
  state.justiceHitCount = 0;
  applyJusticeBurn(context, event, applyCondition, { active: false });
}
