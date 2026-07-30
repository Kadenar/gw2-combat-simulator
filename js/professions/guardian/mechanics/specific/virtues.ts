/**
 * @fileoverview Implements specialization-specific Guardian virtue
 * validation, activation and refresh events, plus resolver-time Justice
 * burning.
 */

import { isGw2PlayerActorEvent } from "../../../../platform/gw2/event-ownership.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../availability.js";
import { emitGuardianEvent } from "../events.js";
import { GUARDIAN_HANDLER_MECHANICS } from "../handler-mechanics.js";
import { handleGuardianVirtueTraits } from "./traits.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type { Gw2ConditionResolution } from "../../../../platform/gw2/types.js";
import type {
  GuardianCastContext,
  GuardianPrecastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSkill,
  GuardianVirtue,
} from "../../types.js";

interface JusticeHitDependencies {
  readonly hitContext?: object;
  readonly applyCondition?: Gw2ConditionResolution["applyCondition"];
}

/**
 * Valid F1-F3 skill names for each Guardian specialization.
 */
export const GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
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

const VIRTUES_BY_SLOT: readonly (GuardianVirtue | null)[] = Object.freeze([
  null,
  "justice",
  "resolve",
  "courage",
]);

/**
 * Checks the resolver's normalized trait set for a numeric or string trait ID.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {SkillId} traitId Trait ID to find.
 * @returns {boolean} Whether the trait is selected.
 */
function hasTrait(context: GuardianResolverContext, traitId: SkillId): boolean {
  return context.traits?.has(traitId) || context.traits?.has(String(traitId));
}

/**
 * Allows only the F1-F3 virtue variants belonging to the selected
 * specialization. Non-virtue skills return no opinion.
 *
 * @param {GuardianPrecastContext} context Cast-validation context.
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {boolean|undefined} Whether the relevant virtue is valid.
 */
export function validateVirtueCast(
  context: GuardianPrecastContext,
  skill: GuardianSkill,
): boolean | undefined {
  if (
    !skill.categories?.includes("Virtue") ||
    !/^Profession_[1-3]$/.test(String(skill.slot || ""))
  )
    return;
  const specialization = selectedGuardianSpecialization(context) || "Core";
  return (
    GUARDIAN_VIRTUE_NAMES_BY_SPECIALIZATION[specialization]?.includes(
      skill.name,
    ) === true
  );
}

/**
 * Activates the virtue represented by the skill's profession slot, opens a
 * Firebrand tome when needed, and emits the resolver transition.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Virtue skill.
 * @returns {boolean} False when the virtue was handled; false also rejects an
 * unrecognized profession slot without emitting a transition.
 */
function activateVirtue(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  const slot = Number(String(skill.slot || "").match(/(\d)$/)?.[1] || 0);
  const virtue = VIRTUES_BY_SLOT[slot];
  if (!virtue) return false;
  if (/^Tome of /.test(skill.name)) {
    context.state.profession.activeTome = virtue;
  }
  emitGuardianEvent(context, skill, "guardian.virtue-activated", {
    virtue,
    specialization:
      skill.specialization || context.config.specialization || "Core",
    passiveReadyAt: context.rechargeReadyAt ?? context.effectiveEnd,
  });
  handleGuardianVirtueTraits(context, skill, virtue);
  return false;
}

/**
 * Clears all Guardian virtue cooldowns after Renewed Focus completes and emits
 * a resolver refresh event.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Renewed Focus skill.
 * @returns {boolean} Always true because this replacing handler owns the cast.
 */
function renewedFocus(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  for (const virtue of context.catalog.skills.filter(
    (candidate) =>
      candidate.categories?.includes("Virtue") &&
      /^Profession_[1-3]$/.test(String(candidate.slot || "")),
  )) {
    context.state.cooldowns.delete(virtue.id);
  }
  emitGuardianEvent(context, skill, "guardian.virtues-refreshed");
  return true;
}

/**
 * Raw virtue callbacks consumed by the central handler registry.
 */
export const guardianVirtueSkillHandlers = Object.freeze({
  "guardian.virtue": activateVirtue,
  "guardian.renewed-focus": renewedFocus,
});

/**
 * Replays a virtue activation into resolver state, including active Justice
 * arming and Firebrand tome selection.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Virtue-activated timeline event.
 * @returns {void}
 */
export function handleVirtueActivation(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  const virtue = event.virtue;
  if (!virtue) return;
  context.profession.virtueReadyAt[virtue] = Number(
    event.passiveReadyAt || event.at,
  );
  if (event.specialization === "Firebrand") {
    context.profession.activeTome = virtue;
  }
  if (
    virtue === "justice" &&
    (event.specialization === "Core" || !event.specialization)
  ) {
    context.profession.justiceActiveArmed = true;
    context.profession.justiceArmed = true;
  }
}

/**
 * Marks all resolver-side virtue passives ready at the refresh timestamp.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Virtues-refreshed timeline event.
 * @returns {void}
 */
export function handleVirtueRefresh(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  context.profession.virtueReadyAt = {
    justice: event.at,
    resolve: event.at,
    courage: event.at,
  };
}

/**
 * Applies and records one active or passive Virtue of Justice burn.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Damage event that triggered Justice.
 * @param {Gw2ConditionResolution["applyCondition"]} applyCondition Condition
 * application helper.
 * @param {{ readonly active: boolean }} options Justice trigger options.
 * @returns {void}
 */
function applyJusticeBurn(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  applyCondition: Gw2ConditionResolution["applyCondition"],
  { active }: { readonly active: boolean },
): void {
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
  context.profession.justiceBurns += 1;
  if (active) context.profession.justiceActiveBurns += 1;
  else context.profession.justicePassiveBurns += 1;
  context.recordProc(
    "profession",
    active ? "Justice Active" : "Justice Passive",
    event.at,
    event.skillName,
  );
}

/**
 * Reacts to an eligible player strike by consuming armed active Justice or by
 * advancing the passive three/five-hit counter.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved damage event.
 * @param {JusticeHitDependencies} dependencies Resolver helpers.
 * @returns {void}
 */
export function reactToJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext, applyCondition }: JusticeHitDependencies = {},
): void {
  if (
    !hitContext ||
    typeof applyCondition !== "function" ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0)
  )
    return;

  const state = context.profession;
  if (state.justiceActiveArmed) {
    state.justiceActiveArmed = false;
    state.justiceArmed = false;
    applyJusticeBurn(context, event, applyCondition, { active: true });
    return;
  }

  const retainsPassive = hasTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE);
  if (!retainsPassive && event.at < Number(state.virtueReadyAt.justice || 0))
    return;

  state.justiceHitCount += 1;
  const triggerHits = hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
    ? 3
    : 5;
  if (state.justiceHitCount < triggerHits) return;
  state.justiceHitCount = 0;
  applyJusticeBurn(context, event, applyCondition, { active: false });
}
