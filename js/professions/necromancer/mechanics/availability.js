import {
  NECROMANCER_AUTOATTACK_CHAINS,
} from "./autoattack-chains.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";

export { hasTrait };

const ENTRY_SHROUD_BY_ID = Object.freeze({
  [ID.DEATH_SHROUD]: "death",
  [ID.REAPERS_SHROUD]: "reaper",
  [ID.HARBINGER_SHROUD]: "harbinger",
  [ID.RITUALISTS_SHROUD]: "ritualist",
});
export const EXIT_IDS = new Set([
  ID.END_DEATH_SHROUD,
  ID.EXIT_REAPERS_SHROUD,
  ID.EXIT_HARBINGER_SHROUD,
  ID.EXIT_RITUALISTS_SHROUD,
]);
const LICH_SKILL_IDS = new Set([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM,
]);
const SHROUD_FOR_SPECIALIZATION = Object.freeze({
  Core: "death",
  Reaper: "reaper",
  Harbinger: "harbinger",
  Ritualist: "ritualist",
});
const INNERVATE_SPIRIT = new Map([
  [ID.INNERVATE_ANGUISH, "anguish"],
  [ID.INNERVATE_WANDERLUST, "wanderlust"],
  [ID.INNERVATE_PRESERVATION, "preservation"],
]);
export const CHAIN_POSITION_BY_ID = new Map();
for (const chain of NECROMANCER_AUTOATTACK_CHAINS) {
  chain.forEach((skillId, index) => {
    CHAIN_POSITION_BY_ID.set(skillId, {
      root: chain[0],
      next: chain[index + 1] ?? null,
    });
  });
}

function specialization(context) {
  return context.config?.specialization || "Core";
}

export function requiredShroud(skill) {
  return String(skill.shroud || "");
}

const READY = Object.freeze({ ready: true });

// Structured availability denial. Reasons keep the "<skill> is unavailable"
// prefix so rotations read consistently, then append a specific cause and carry
// a machine-readable code. retryAt stays null for these gates: necromancer
// resource/state gates (life force, shroud sequencing, chains) have no fixed
// ready-time under a scripted rotation, so a denial is final rather than a wait.
function deny(skill, code, cause) {
  return Object.freeze({
    ready: false,
    retryAt: null,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  });
}

// Autoattack-chain position gate shared by in-shroud and baseline skills: a
// chain link is castable only when it is the expected next link.
function chainVerdict(skill, state) {
  const chain = CHAIN_POSITION_BY_ID.get(skill.id);
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
function devouringGate(context, skill, { activeShroud }) {
  if (skill.id !== ID.DEVOURING_DARKNESS) return null;
  if (!hasTrait(context, TRAIT.LINGERING_CURSE)) {
    return deny(skill, "necromancer.trait-locked", "requires Lingering Curse.");
  }
  return activeShroud
    ? deny(skill, "necromancer.in-shroud", `cannot cast in ${activeShroud} shroud.`)
    : READY;
}

function shroudEntryGate(_context, skill, { state, activeShroud, spec }) {
  if (!ENTRY_SHROUD_BY_ID[skill.id]) return null;
  if (activeShroud) {
    return deny(skill, "necromancer.in-shroud", `already in ${activeShroud} shroud.`);
  }
  const expected = SHROUD_FOR_SPECIALIZATION[spec] || "death";
  if (ENTRY_SHROUD_BY_ID[skill.id] !== expected) {
    return deny(
      skill,
      "necromancer.wrong-specialization",
      `not available for the ${spec} specialization.`,
    );
  }
  if (spec !== "Harbinger" && Number(state.lifeForce || 0) < 10) {
    return deny(
      skill,
      "necromancer.insufficient-life-force",
      "requires 10 life force.",
    );
  }
  return READY;
}

function shroudExitGate(context, skill, { state, activeShroud }) {
  if (!EXIT_IDS.has(skill.id)) return null;
  const parent = context.catalog.skillsById.get(skill.flipParentId);
  const parentShroud =
    ENTRY_SHROUD_BY_ID[parent?.id] || requiredShroud(parent);
  const available =
    activeShroud === parentShroud
    || Number(state.availableFlips[skill.id] || 0) > context.start;
  return available
    ? READY
    : deny(skill, "necromancer.not-in-shroud", "the matching shroud is not active.");
}

function lichFormGate(_context, skill, { activeShroud }) {
  if (skill.id !== ID.LICH_FORM) return null;
  return activeShroud
    ? deny(skill, "necromancer.in-shroud", `cannot cast in ${activeShroud} shroud.`)
    : READY;
}

function lichSkillGate(_context, skill, { activeShroud }) {
  if (!LICH_SKILL_IDS.has(skill.id)) return null;
  return activeShroud === "lich"
    ? READY
    : deny(skill, "necromancer.requires-lich", "requires Lich Form.");
}

function inShroudGate(_context, skill, { state, activeShroud }) {
  const shroud = requiredShroud(skill);
  if (!shroud) return null;
  if (activeShroud !== shroud) {
    return deny(skill, "necromancer.wrong-shroud", `requires ${shroud} shroud.`);
  }
  return chainVerdict(skill, state);
}

function spiritGate(_context, skill, { state, activeShroud }) {
  const spirit = INNERVATE_SPIRIT.get(skill.id);
  if (!spirit) return null;
  return activeShroud === "ritualist" && Boolean(state.activeSpirits?.[spirit])
    ? READY
    : deny(
        skill,
        "necromancer.spirit",
        `requires an active ${spirit} spirit in Ritualist shroud.`,
      );
}

// Terminal gate for ordinary out-of-shroud skills. Always yields a verdict.
function baselineGate(context, skill, { state, activeShroud }) {
  if (activeShroud) {
    return deny(skill, "necromancer.in-shroud", `cannot cast in ${activeShroud} shroud.`);
  }
  if (
    skill.lifeForceCost
    && Number(state.lifeForce || 0) < Number(skill.lifeForceCost)
  ) {
    return deny(
      skill,
      "necromancer.insufficient-life-force",
      `requires ${skill.lifeForceCost} life force.`,
    );
  }
  if (
    skill.flipParentId != null
    && !(Number(state.availableFlips[skill.id] || 0) > context.start)
  ) {
    return deny(skill, "necromancer.flip-not-armed", "not currently armed.");
  }
  return chainVerdict(skill, state);
}

// First-match dispatch: each gate returns a verdict for skills in its domain or
// null to defer. Order reproduces the original if-ladder exactly, so the first
// non-null verdict is authoritative.
const CAST_STATE_GATES = Object.freeze([
  devouringGate,
  shroudEntryGate,
  shroudExitGate,
  lichFormGate,
  lichSkillGate,
  inShroudGate,
  spiritGate,
  baselineGate,
]);

/**
 * Permanent build gating: nothing here can become valid mid-rotation, so it
 * stays a boolean validator rather than a waitable availability constraint.
 */
export function validateNecromancerBuild(context, skill) {
  if (!skill.implemented || skill.simulatorExcluded) return false;
  if (
    skill.type !== "Weapon" &&
    skill.specialization &&
    skill.specialization !== specialization(context)
  ) {
    return false;
  }
  if (
    skill.id === ID.FEAST_OF_CORRUPTION
    && hasTrait(context, TRAIT.LINGERING_CURSE)
  ) return false;
  if (
    skill.id === ID.SANDSTORM_SHROUD
    && !hasTrait(context, TRAIT.HERALD_OF_SORROW)
  ) return false;
  if (
    skill.id === ID.DESERT_SHROUD
    && hasTrait(context, TRAIT.HERALD_OF_SORROW)
  ) return false;
  return true;
}

/**
 * Structured state/resource availability. Returns {ready:true} or a denial with
 * a specific reason and code, replacing the former monolithic boolean ladder.
 */
export function necromancerCastAvailability(context, skill) {
  const state = context.state.profession;
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
