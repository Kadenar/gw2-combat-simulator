import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  actualNecromancerLifeForceCost,
  normalizedNecromancerLifeForceCost,
} from "./state.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import type {
  AvailabilityResult,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  NecromancerPrecastContext,
  NecromancerCoreState,
  NecromancerSkill,
} from "../types.js";

export { hasTrait };

const ENTRY_SHROUD_BY_ID: Readonly<Record<SkillId, string>> = Object.freeze({
  [ID.DEATH_SHROUD]: "death",
  [ID.REAPERS_SHROUD]: "reaper",
  [ID.HARBINGER_SHROUD]: "harbinger",
  [ID.RITUALISTS_SHROUD]: "ritualist",
});
export const EXIT_IDS: ReadonlySet<SkillId> = new Set([
  ID.END_DEATH_SHROUD,
  ID.EXIT_REAPERS_SHROUD,
  ID.EXIT_HARBINGER_SHROUD,
  ID.EXIT_RITUALISTS_SHROUD,
]);
const LICH_SKILL_IDS: ReadonlySet<SkillId> = new Set([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM,
]);
const SHROUD_FOR_SPECIALIZATION: Readonly<Record<string, string>> =
  Object.freeze({
    Core: "death",
    Reaper: "reaper",
    Harbinger: "harbinger",
    Ritualist: "ritualist",
  });
const INNERVATE_SPIRIT: ReadonlyMap<SkillId, string> = new Map([
  [ID.INNERVATE_ANGUISH, "anguish"],
  [ID.INNERVATE_WANDERLUST, "wanderlust"],
  [ID.INNERVATE_PRESERVATION, "preservation"],
]);
interface AvailabilityEnvironment {
  readonly state: NecromancerCoreState;
  readonly activeShroud: string;
  readonly spec: string;
}

type AvailabilityVerdict = Readonly<AvailabilityResult> | null;

type CastStateGate = (
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  environment: AvailabilityEnvironment,
) => AvailabilityVerdict;

function specialization(context: NecromancerPrecastContext): string {
  return context.config?.specialization || "Core";
}

export function requiredShroud(skill?: NecromancerSkill): string {
  return String(skill?.shroud || "");
}

const READY: Readonly<AvailabilityResult> = Object.freeze({ ready: true });

// Structured availability denial. Reasons keep the "<skill> is unavailable"
// prefix so rotations read consistently, then append a specific cause and carry
// a machine-readable code. retryAt stays null for these gates: necromancer
// resource/state gates (life force, shroud sequencing, chains) have no fixed
// ready-time under a scripted rotation, so a denial is final rather than a wait.
function deny(
  skill: NecromancerSkill,
  code: string,
  cause: string,
): Readonly<AvailabilityResult> {
  return Object.freeze({
    ready: false,
    retryAt: null,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  });
}

// Autoattack-chain position gate shared by in-shroud and baseline skills: a
// chain link is castable only when it is the expected next link.
function chainVerdict(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  state: NecromancerCoreState,
): Readonly<AvailabilityResult> {
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (!chain) return READY;
  const expected = state.autoattackChains[chain.root] || chain.root;
  return expected === skill.id
    ? READY
    : deny(
        skill,
        "necromancer.autoattack-chain",
        "cast the earlier chain skill first.",
      );
}

// The Devouring Darkness / Feast of Corruption swap terminates here so its
// out-of-shroud requirement never falls through to the baseline gate (which the
// original if-ladder skipped for this skill via an early return).
function devouringGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { activeShroud }: AvailabilityEnvironment,
): AvailabilityVerdict {
  if (skill.id !== ID.DEVOURING_DARKNESS) return null;
  if (!hasTrait(context, TRAIT.LINGERING_CURSE)) {
    return deny(skill, "necromancer.trait-locked", "requires Lingering Curse.");
  }
  return activeShroud
    ? deny(
        skill,
        "necromancer.in-shroud",
        `cannot cast in ${activeShroud} shroud.`,
      )
    : READY;
}

function shroudEntryGate(
  _context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud, spec }: AvailabilityEnvironment,
): AvailabilityVerdict {
  if (!ENTRY_SHROUD_BY_ID[skill.id]) return null;
  if (activeShroud) {
    return deny(
      skill,
      "necromancer.in-shroud",
      `already in ${activeShroud} shroud.`,
    );
  }
  const expected = SHROUD_FOR_SPECIALIZATION[spec] || "death";
  if (ENTRY_SHROUD_BY_ID[skill.id] !== expected) {
    return deny(
      skill,
      "necromancer.wrong-specialization",
      `not available for the ${spec} specialization.`,
    );
  }
  if (
    spec !== "Harbinger" &&
    Number(state.lifeForce || 0) < Number(state.maximumLifeForce || 100) * 0.1
  ) {
    return deny(
      skill,
      "necromancer.insufficient-life-force",
      "requires 10 life force.",
    );
  }
  return READY;
}

function shroudExitGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud }: AvailabilityEnvironment,
): AvailabilityVerdict {
  if (!EXIT_IDS.has(skill.id)) return null;
  const parent =
    skill.flipParentId == null
      ? undefined
      : context.catalog.skillsById.get(skill.flipParentId);
  const parentShroud = parent
    ? ENTRY_SHROUD_BY_ID[parent.id] || requiredShroud(parent)
    : "";
  const available =
    activeShroud === parentShroud ||
    Number(state.availableFlips[skill.id] || 0) > context.start;
  return available
    ? READY
    : deny(
        skill,
        "necromancer.not-in-shroud",
        "the matching shroud is not active.",
      );
}

function lichFormGate(
  _context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { activeShroud }: AvailabilityEnvironment,
): AvailabilityVerdict {
  if (skill.id !== ID.LICH_FORM) return null;
  return activeShroud
    ? deny(
        skill,
        "necromancer.in-shroud",
        `cannot cast in ${activeShroud} shroud.`,
      )
    : READY;
}

function lichSkillGate(
  _context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { activeShroud }: AvailabilityEnvironment,
): AvailabilityVerdict {
  if (!LICH_SKILL_IDS.has(skill.id)) return null;
  return activeShroud === "lich"
    ? READY
    : deny(skill, "necromancer.requires-lich", "requires Lich Form.");
}

function inShroudGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud }: AvailabilityEnvironment,
): AvailabilityVerdict {
  const shroud = requiredShroud(skill);
  if (!shroud) return null;
  if (activeShroud !== shroud) {
    return deny(
      skill,
      "necromancer.wrong-shroud",
      `requires ${shroud} shroud.`,
    );
  }
  return chainVerdict(context, skill, state);
}

function spiritGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  _environment: AvailabilityEnvironment,
): AvailabilityVerdict {
  const spirit = INNERVATE_SPIRIT.get(skill.id);
  if (!spirit) return null;
  const active = context.state.profession.specialization;
  return active.kind === "Ritualist" &&
    Boolean(active.state.activeSpirits[spirit])
    ? READY
    : deny(skill, "necromancer.spirit", `requires an active ${spirit} spirit.`);
}

function activeMinionGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state }: AvailabilityEnvironment,
): AvailabilityVerdict {
  if (!skill.rechargeOnMinionDeath) return null;
  const commandAvailableUntil = Number(
    skill.flipSkillId == null
      ? 0
      : state.availableFlips?.[skill.flipSkillId] || 0,
  );
  return commandAvailableUntil > context.start
    ? deny(
        skill,
        "necromancer.minion-active",
        "its summoned minion is still alive.",
      )
    : null;
}

function selectedSlotSkillGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
): AvailabilityVerdict {
  if (
    !["Heal", "Utility", "Elite"].includes(String(skill.type || "")) ||
    skill.flipParentId != null
  ) {
    return null;
  }
  const source = context.config?.selectedSkills || [];
  const selected = Array.isArray(source) ? source : Object.values(source);
  if (!selected.length || selected.includes(skill.name)) return null;
  return deny(skill, "necromancer.slot-skill", "the skill is not equipped.");
}

// Terminal gate for ordinary out-of-shroud skills. Always yields a verdict.
function baselineGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud }: AvailabilityEnvironment,
): Readonly<AvailabilityResult> {
  if (activeShroud) {
    return deny(
      skill,
      "necromancer.in-shroud",
      `cannot cast in ${activeShroud} shroud.`,
    );
  }
  if (
    skill.lifeForceCost &&
    Number(state.lifeForce || 0) <
      normalizedNecromancerLifeForceCost(state, skill.lifeForceCost)
  ) {
    return deny(
      skill,
      "necromancer.insufficient-life-force",
      `requires ${Math.round(
        actualNecromancerLifeForceCost(skill.lifeForceCost),
      )} life force.`,
    );
  }
  if (
    skill.flipParentId != null &&
    !(Number(state.availableFlips[skill.id] || 0) > context.start)
  ) {
    return deny(skill, "necromancer.flip-not-armed", "not currently armed.");
  }
  return chainVerdict(context, skill, state);
}

// First-match dispatch: each gate returns a verdict for skills in its domain or
// null to defer. Order reproduces the original if-ladder exactly, so the first
// non-null verdict is authoritative.
const CAST_STATE_GATES: readonly CastStateGate[] = Object.freeze([
  devouringGate,
  shroudEntryGate,
  shroudExitGate,
  lichFormGate,
  lichSkillGate,
  inShroudGate,
  spiritGate,
  selectedSlotSkillGate,
  activeMinionGate,
  baselineGate,
]);

/**
 * Permanent build gating: nothing here can become valid mid-rotation, so it
 * stays a boolean validator rather than a waitable availability constraint.
 */
export function validateNecromancerBuild(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
): boolean {
  if (!skill.implemented || skill.simulatorExcluded) return false;
  if (
    skill.type !== "Weapon" &&
    skill.specialization &&
    skill.specialization !== specialization(context)
  ) {
    return false;
  }
  if (
    skill.id === ID.FEAST_OF_CORRUPTION &&
    hasTrait(context, TRAIT.LINGERING_CURSE)
  )
    return false;
  if (
    skill.id === ID.SANDSTORM_SHROUD &&
    !hasTrait(context, TRAIT.HERALD_OF_SORROW)
  )
    return false;
  if (
    skill.id === ID.DESERT_SHROUD &&
    hasTrait(context, TRAIT.HERALD_OF_SORROW)
  )
    return false;
  return true;
}

/**
 * Structured state/resource availability. Returns {ready:true} or a denial with
 * a specific reason and code, replacing the former monolithic boolean ladder.
 */
export function necromancerCastAvailability(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
): Readonly<AvailabilityResult> {
  const state = professionCoreState(context);
  const env = {
    state,
    activeShroud: String(state.activeShroud || ""),
    spec: specialization(context),
  };
  for (const gate of CAST_STATE_GATES) {
    const verdict = gate(context, skill, env);
    if (verdict != null) return verdict;
  }
  return READY;
}
