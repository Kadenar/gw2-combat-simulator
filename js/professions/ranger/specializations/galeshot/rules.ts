import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  RangerCastContext,
  RangerPrecastContext,
  RangerSkill,
} from "../../types.js";
import { rangerPetByName } from "../../core/state.js";
import { galeshotState } from "./state.js";
import {
  advanceGaleshotArrows,
  completeGaleshotSkill,
  handleGaleshotDisableTask,
  handleGaleshotMissileHitTask,
  handleGaleshotPetHitTask,
  observeGaleshotEvent,
} from "./mechanics.js";
import {
  rangerBalanceProfile,
  rangerBalanceProfileEffect,
  rangerBalanceValue,
} from "../../core/profiles.js";
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";

function emitCloudburstBoons(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  if (!hasTrait(context, TRAIT.CLOUDBURST)) return;
  const hawkeye = skill.id === ID.HAWKEYE;
  const profile = rangerBalanceProfile(context, PROFILE.cloudburst);
  for (let boonIndex = 0; boonIndex < 2; boonIndex += 1) {
    const effect = rangerBalanceProfileEffect(
      profile,
      "boon",
      (hawkeye ? 2 : 0) + boonIndex,
    );
    const kind = String(effect?.boon || ["quickness", "might"][boonIndex]);
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.CLOUDBURST,
      actorType: "effect",
      skillId: TRAIT.CLOUDBURST,
      skillName: "Cloudburst",
      name: `Cloudburst - ${kind}`,
      kind,
      boon: kind,
      duration: Number(
        effect?.duration ?? (boonIndex === 0 ? (hawkeye ? 8 : 4) : 10),
      ),
      stacks: Number(effect?.stacks ?? (boonIndex === 0 ? 1 : hawkeye ? 8 : 4)),
      recipients: "party",
      maximumRecipients: 5,
      triggeredBy: skill.name,
    });
  }
}

export function applyGaleshotCycloneBowTraits(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = galeshotState.from(context);
  if (skill.id === ID.HAWKEYE) {
    if (hasTrait(context, TRAIT.GALE_FORCE)) {
      const effect = rangerBalanceProfileEffect(
        rangerBalanceProfile(context, PROFILE.galeForce),
        "buff",
      );
      const duration = Number(effect?.duration ?? 10);
      // galeForceUntil is a timestamp, not a duration; compare against context.time in modifiers.
      state.galeForceUntil = context.effectiveEnd + duration;
      context.emit({
        type: "buff",
        at: context.effectiveEnd,
        source: "Trait",
        sourceId: TRAIT.GALE_FORCE,
        actorType: "effect",
        skillId: TRAIT.GALE_FORCE,
        skillName: "Gale Force",
        kind: String(effect?.kind || "gale-force"),
        duration,
        stacks: Number(effect?.stacks ?? 1),
        triggeredBy: skill.name,
      });
    }
    emitCloudburstBoons(context, skill);
    return;
  }
  if (skill.id === ID.BLUSTER) {
    // Wuthering Wind is primed by Bluster; the charge is only consumable at or
    // after effectiveEnd so the same cast can't immediately trigger itself.
    state.wutheringWindReady = hasTrait(context, TRAIT.WUTHERING_WIND);
    state.wutheringWindReadyAt = context.effectiveEnd;
    emitCloudburstBoons(context, skill);
  }
  if (
    hasTrait(context, TRAIT.CLOUDBURST) &&
    [ID.QUARRYS_PERIL, ID.SUPERSONIC_ARROW].includes(
      skill.id as typeof ID.QUARRYS_PERIL | typeof ID.SUPERSONIC_ARROW,
    )
  ) {
    // Cloudburst trait: these two skills reset Bluster's cooldown on cast.
    context.state.cooldowns.delete(ID.BLUSTER);
  }
}

export const galeshotSchedulerHooks = Object.freeze({
  advance: {
    id: "ranger.galeshot-arrows",
    order: 20,
    handler: advanceGaleshotArrows,
  },
  onCastComplete: {
    id: "ranger.galeshot-traits",
    order: 20,
    handler: completeGaleshotSkill,
  },
  onEventScheduled: {
    id: "ranger.galeshot-events",
    order: 20,
    handler: observeGaleshotEvent,
  },
  taskHandlers: Object.freeze({
    "ranger.galeshot-missile-hit": handleGaleshotMissileHitTask,
    "ranger.galeshot-pet-hit": handleGaleshotPetHitTask,
    "ranger.galeshot-disable": handleGaleshotDisableTask,
  }),
});

function deny(
  skill: RangerSkill,
  code: string,
  cause: string,
): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`,
  };
}

export function galeshotCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  const state = galeshotState.from(context);
  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return deny(
      skill,
      "ranger.cyclone-bow-inactive",
      "summon the Cyclone Bow first.",
    );
  }
  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return deny(
      skill,
      "ranger.cyclone-bow-active",
      "the Cyclone Bow is already active.",
    );
  }
  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return deny(
      skill,
      "ranger.cyclone-bow-inactive",
      "the Cyclone Bow is not active.",
    );
  }
  if (Number(skill.arrowCost || 0) > state.arrows) {
    return deny(skill, "ranger.arrows", `requires ${skill.arrowCost} arrows.`);
  }
  const maximumWindForce = rangerBalanceValue(
    context,
    PROFILE.resources,
    "minimumStacks",
    5,
  );
  if (skill.id === ID.HAWKEYE && state.windForce < maximumWindForce) {
    return deny(
      skill,
      "ranger.wind-force",
      `requires ${maximumWindForce} Wind Force.`,
    );
  }
  if (skill.id === ID.KEEN_SHOT && state.windForce >= maximumWindForce) {
    return deny(
      skill,
      "ranger.hawkeye-ready",
      "Hawkeye replaces Keen Shot at 5 Wind Force.",
    );
  }
  if (
    skill.id === ID.QUARRYS_PERIL &&
    hasTrait(context, TRAIT.PERILOUS_SKIES)
  ) {
    return deny(skill, "ranger.perilous-skies", "Pelt replaces this skill.");
  }
  if (skill.id === ID.PELT && !hasTrait(context, TRAIT.PERILOUS_SKIES)) {
    return deny(
      skill,
      "ranger.perilous-skies",
      "select Perilous Skies to replace Quarry's Peril.",
    );
  }
  if (
    state.cycloneBowActive &&
    skill.type === "Weapon" &&
    !skill.cycloneBowSkill
  ) {
    return deny(
      skill,
      "ranger.cyclone-bow-weapon-bar",
      "the Cyclone Bow replaces weapon skills.",
    );
  }
  return { ready: true };
}

function galeshotRuntimeState(context: Gw2ModifierContext) {
  const profession = context.runtime?.profession as
    | {
        specialization?: {
          kind?: string;
          state?: { windForce?: number; galeForceUntil?: number };
        };
      }
    | undefined;
  return profession?.specialization?.kind === "Galeshot"
    ? profession.specialization.state
    : undefined;
}

function windForce(context: Gw2ModifierContext): number {
  return Number(galeshotRuntimeState(context)?.windForce || 0);
}

function galeForceAmount(
  context: Gw2ModifierContext,
  parameters: Readonly<Record<string, number>>,
): number {
  const galeForce =
    Number(galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time
      ? parameters.galeForceBonus
      : 0;
  // Hawkeye converts the five existing stacks into a 25% flat bonus (galeForce),
  // but Wind Force earned while Gale Force is active still adds 3% per stack on top.
  return galeForce + windForce(context) * parameters.windForcePerStack;
}

function activePetIsFeathered(context: Gw2ModifierContext): boolean {
  const runtime = context.runtime as
    { profession?: { core?: { activePet?: string } } } | undefined;
  const name = String(
    runtime?.profession?.core?.activePet || context.config?.selectedPet || "",
  );
  return ["avian", "moa", "phoenix", "raptor swiftwing"].includes(
    rangerPetByName(name).family,
  );
}

function eventSkillId(context: Gw2ModifierContext): number {
  return Number(context.event?.skillId ?? context.skillId);
}

export const galeshotModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "ranger.bird-of-prey",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.05,
    when: (context) =>
      context.event?.actorType !== "summon" &&
      hasTrait(context, TRAIT.BIRD_OF_PREY) &&
      Boolean(context.config?.boons?.swiftness),
  },
  {
    id: "ranger.gale-force",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    parameters: {
      galeForceBonus: 0.25,
      windForcePerStack: 0.03,
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      galeForceAmount(context, parameters),
    when: (context) =>
      context.event?.actorType !== "summon" &&
      hasTrait(context, TRAIT.GALE_FORCE) &&
      (Number(galeshotRuntimeState(context)?.galeForceUntil || 0) >
        context.time ||
        windForce(context) > 0),
  },
  {
    id: "ranger.flock-together",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    when: (context) =>
      context.event?.actorType === "summon" &&
      context.event?.source === "ranger-pet" &&
      hasTrait(context, TRAIT.FLOCK_TOGETHER) &&
      activePetIsFeathered(context),
  },
  {
    id: "ranger.piercing-gales-vulnerability",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    // Piercing Gales applies its own doubled vulnerability multiplier (2% per
    // stack) in addition to the standard vulnerability already baked into the
    // platform strikeMultiplier, effectively tripling the vulnerability bonus
    // for this skill.
    parameters: {
      baseFactor: 1,
      vulnerabilityPerStack: 0.02,
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      Number(
        context.query?.vulnerabilityStacksAt(
          context.time,
          context.runtime || undefined,
        ) || 0,
      ) *
        parameters.vulnerabilityPerStack,
    when: (context) => eventSkillId(context) === ID.PIERCING_GALES,
  },
]);

export const galeshotAttributeRules = Object.freeze({
  modifierRules: galeshotModifierRules,
});
export const galeshotCastRules = Object.freeze({
  availability: {
    id: "ranger.galeshot-availability",
    order: 20,
    handler: galeshotCastAvailability,
  },
});
