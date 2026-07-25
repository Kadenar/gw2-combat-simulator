// Public simulation orchestrator
// Two-phase pipeline: 1) Scheduler (action sequencing), 2) Resolver (damage calculation)
// Exposes simulateRotation (repeatable) and simulateSequence (single-pass builder mode)

import {
  AMBUSH_ATTACKS,
  CLONE_ATTACKS,
  PHANTASM_ATTACK_TIMINGS,
  PHANTASM_NAME_BY_SKILL,
  WEAPON_STRENGTH,
} from "./data/mesmer-illusion-data.js";
import {
  ARISTOCRACY_SKILLS,
  BLIND_SKILLS,
  CONDITION_FORMULAS,
  CONTROL_SKILLS,
  INSTRUMENTS,
  MECHANIC_SKILLS,
  PEITHA_SKILLS,
  SHATTERS,
  TRAIT_DAMAGE,
} from "./data/mesmer-profession-data.js";
import {
  AUTOATTACK_CHAINS,
} from "./mechanics/mesmer-skill-overrides.js";
import { MESMER_SKILLS, mesmerCatalog } from "./catalog.js";
import { prepareSimulationConfig } from "../../platform/engine/prepare-config.js";
import { buildScheduledEventStream } from "../../platform/engine/scheduled-event-stream.js";
import { EPSILON } from "../../platform/engine/clock.js";
import { resolveScheduledStream } from "./resolver/resolve-timeline.js";
import { buildResolverQuery } from "./resolver/resolver-query.js";
import { createScheduler } from "./scheduler/scheduler.js";
import {
  normalizeRotation,
  toLegacyRotationEntry,
} from "../../platform/engine/rotation-commands.js";
import {
  gw2ConditionDurationMultiplier,
  gw2EffectiveCooldown,
  gw2RechargeRate,
  gw2SigilSet,
  gw2StaticAttributes,
  gw2WeaponStrength,
} from "../../platform/gw2/runtime-rules.js";

/** Safety limit to prevent infinite action loops in rotation simulations. */
const MAX_ACTIONS = 10_000;
/** Cooldown IDs unaffected by Continuum Split (e.g., weapon swap). */
const CONTINUUM_UNAFFECTED_COOLDOWN_IDS = new Set([-3]);
/** Relic of Thorns: first hit at 3s. */
const THORNS_FIRST_HIT = 3;
/** Relic of Thorns: hit interval in seconds. */
const THORNS_HIT_INTERVAL = 5;
/** Relic of Thorns: condition damage per hit. */
const THORNS_CONDITION_DAMAGE = 30;
/** Relic of Thorns: maximum stack count. */
const THORNS_MAX_STACKS = 10;

const allSkills = MESMER_SKILLS;
const skillsById = new Map(allSkills.map((skill) => [skill.id, skill]));
const skillsByName = new Map(allSkills.map((skill) => [skill.name, skill]));
const byName = (name) => skillsByName.get(name);
const flipSkillsByParent = new Map(
  allSkills
    .filter((skill) => skill.flipParent)
    .map((skill) => [skill.flipParent, skill]),
);
const autoattackChainPositions = new Map(
  Object.entries(AUTOATTACK_CHAINS).flatMap(([root, names]) =>
    names.map((name, index) => [name, { root, index }]),
  ),
);

/** Clamps value to [min, max] range. */
const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

/** Normalizes condition names (e.g., "poison" → "Poisoned", "burning" → "Burning"). */
const conditionName = (name) => {
  const normalized = String(name || "").toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") return "Poisoned";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

/** Removes duplicate values from array. */
const unique = (values) => [...new Set(values)];

/**
 * Filters events by type, enforcing internal cooldown (ICD) spacing.
 * Only returns events that do not fire within the cooldown interval of previous activations.
 * @param {Array} events - Events to filter
 * @param {string} type - Event type to match
 * @param {number} cooldown - Cooldown duration in seconds
 * @returns {Array} Events respecting ICD spacing
 */
function qualifyingIcdEvents(events, type, cooldown) {
  const activations = [];
  let readyAt = 0;
  for (const event of events) {
    if (event.type !== type || event.at < readyAt - EPSILON) continue;
    activations.push(event);
    readyAt = event.at + cooldown;
  }
  return activations;
}

/**
 * Calculates Relic of Thorns stack count at a given time.
 * Starts at 3s, triggers every 5s, max 10 stacks.
 * @param {number} time - Time in seconds
 * @returns {number} Stack count at that time
 */
function thornsStacksAt(time) {
  if (time < THORNS_FIRST_HIT - EPSILON) return 0;
  return Math.min(
    THORNS_MAX_STACKS,
    Math.floor((time - THORNS_FIRST_HIT + EPSILON) / THORNS_HIT_INTERVAL) + 1,
  );
}

/**
 * Creates default simulation config with baseline stats, boons, and target state.
 * Config: 30s fight, Virtuoso specialization, Dagger/Sword weapons, standard PvE stats.
 * @returns {Object} Default config object
 */
export function createDefaultConfig() {
  return {
    duration: 30,
    specialization: "Virtuoso",
    selectedTraits: [],
    selectedSkills: [],
    primaryWeapon: "Dagger",
    secondaryWeapon: "Sword",
    weaponSet2Primary: "Spear",
    weaponSet2Secondary: "",
    startingWeaponSet: 1,
    sigilSets: [
      {
        criticalChanceBonus: 0,
        strike: 1,
        condition: 1,
        conditionDurationBonus: 0,
        conditionDurationBonuses: {},
      },
      {
        criticalChanceBonus: 0,
        strike: 1,
        condition: 1,
        conditionDurationBonus: 0,
        conditionDurationBonuses: {},
      },
    ],
    weaponmasterTraining: true,
    autoWaitForCooldowns: true,
    initialResource: 5,
    stats: {
      power: 2500,
      precision: 2250,
      ferocity: 1500,
      conditionDamage: 1500,
      expertise: 750,
      vitality: 1000,
      conditionDurationBonus: 0,
      conditionDurationBonuses: {},
    },
    boons: {
      might: 25,
      fury: true,
      quickness: true,
      alacrity: true,
      regeneration: true,
      vigor: true,
    },
    target: {
      armor: 2597,
      health: 3970000,
      conditions: {
        Bleeding: 1,
        Burning: true,
        Torment: 1,
        Confusion: 1,
        Poisoned: true,
        Chilled: true,
        Cripple: true,
        Slow: true,
        Weakness: true,
        Vulnerability: 25,
      },
      boonless: true,
      moving: false,
      nearby: true,
      activatingSkills: false,
      confusionActivationsPerSecond: 0,
    },
  };
}

/**
 * Gets resource definition (singular/plural names, max count) for specialization.
 * Virtuoso: blades (max 5), Troubadour: notes (max 3), others: clones (max 3).
 * @param {string} specialization - Specialization name
 * @returns {Object} {singular, plural, maximum}
 */
export function getResourceDefinition(specialization) {
  if (specialization === "Virtuoso") {
    return { singular: "blade", plural: "blades", maximum: 5 };
  }
  if (specialization === "Troubadour") {
    return { singular: "note", plural: "notes", maximum: 3 };
  }
  return { singular: "clone", plural: "clones", maximum: 3 };
}

/** Converts selected trait names to a Set for fast lookup. */
function selectedTraitSet(config) {
  return new Set(config.selectedTraits || []);
}

/**
 * Calculates effective cooldown for a skill given config (traits, boons).
 * Applies: Master of Misdirection (-15% for shatters), Fencer's Finesse
 * (-20% for sword skills), Alacrity (+25% recharge speed), and Chronomancer's
 * Time Marches On (+50% Alacrity recharge speed).
 * @param {Object} skill - Skill with cooldown property
 * @param {Object} config - Simulation config
 * @returns {number} Adjusted cooldown in seconds
 */
function adjustedCooldown(skill, config) {
  if (skill.name === "Swap Weapons") return Number(skill.cooldown || 0);
  if (skill.name === "Dodge / Mirage Cloak") {
    return Number(skill.cooldown || 0) / (config.boons?.vigor ? 1.5 : 1);
  }
  let traitModifier = 1;
  const selectedTraits = config.selectedTraits || [];
  if (
    SHATTERS[skill.name]
    && selectedTraits.includes("Master of Misdirection")
  ) {
    traitModifier *= 0.85;
  }
  if (
    skill.weapon === "Sword"
    && selectedTraits.includes("Fencer's Finesse")
  ) {
    traitModifier *= 0.8;
  }
  return gw2EffectiveCooldown(skill, config, {
    cooldownMultiplier: traitModifier,
    rechargeRate: gw2RechargeRate(config, {
      alacrityRate: config.specialization === "Chronomancer" ? 1.5 : 1.25,
    }),
  });
}

/**
 * Resolves weapon strength multiplier for an event.
 * Checks: explicit weaponStrength, event.weapon, event.skillWeapon, primaryWeapon, fallback Utility.
 * @param {Object} event - Scheduled event (may have weapon/skillWeapon property)
 * @param {Object} config - Simulation config with primaryWeapon
 * @returns {number} Weapon strength multiplier
 */
const weaponStrength = (event, config) => gw2WeaponStrength(event, config, {
  strengths: WEAPON_STRENGTH,
  aliases: {
    "phantasm high": "Phantasm high",
    "phantasm medium": "Phantasm medium",
  },
});

/**
 * Checks if a skill is available in the given config.
 * Accounts for: environment, specialization, type (Profession/Weapon), weaponmaster training.
 * @param {Object} skill - Skill to check
 * @param {Object} config - Simulation config
 * @returns {boolean} True if skill can be used
 */
function skillAvailable(skill, config) {
  if (skill.ambush) return config.specialization === "Mirage";
  if (skill.id < 0) {
    return (
      !skill.specialization ||
      skill.specialization === config.specialization
    );
  }
  if (skill.environment !== "Terrestrial") return false;
  if (skill.type === "Profession") {
    return (MECHANIC_SKILLS[config.specialization] || []).includes(skill.name);
  }
  if (
    skill.specialization &&
    skill.type !== "Weapon" &&
    skill.specialization !== config.specialization
  ) {
    return false;
  }
  if (
    skill.specialization &&
    skill.type === "Weapon" &&
    !config.weaponmasterTraining &&
    skill.specialization !== config.specialization
  ) {
    return false;
  }
  return true;
}

/**
 * Calculates base attributes from config + boons.
 * Might stacks add +30 power and condition damage per stack.
 * @param {Object} config - Simulation config with stats/boons
 * @returns {Object} {power, precision, ferocity, conditionDamage, expertise, conditionDurationBonus, conditionDurationBonuses}
 */
const staticAttributes = config => gw2StaticAttributes(config);

/**
 * Gets sigil set for a weapon set index (1 or 2).
 * @param {Object} config - Simulation config with sigilSets array
 * @param {number} weaponSet - Weapon set (1 or 2)
 * @returns {Object} Sigil set object
 */
const sigilSet = (config, weaponSet) => gw2SigilSet(config, weaponSet);

/**
 * Calculates critical hit chance for an action source.
 * Base: 5% + (precision-1000)/2100. Fury: +25%, Mistburn+10 might: +10%, Flow of Time+alacrity: +15%,
 * Quiet Intensity+fury: +15%, Phantasmal Fury (Virtuoso: +40%, other: +25%).
 * @param {Object} config - Simulation config
 * @param {Set} traits - Selected traits
 * @param {string} source - Action source: "Player", "Clone", "Phantasm", etc.
 * @param {number} weaponSet - Weapon set for sigil bonuses (default 1)
 * @returns {number} Crit chance [0, 1]
 */
function baseCriticalChance(config, traits, source = "Player", weaponSet = 1) {
  const stats = staticAttributes(config, traits);
  const illusion = source === "Clone" || source === "Phantasm";
  let chance = 0.05 + Math.max(0, stats.precision - 1000) / 2100;
  if (!illusion) {
    chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
    chance += Number(sigilSet(config, weaponSet).criticalChanceBonus || 0) / 100;
  }
  if (!illusion && config.boons?.fury) chance += 0.25;
  if (
    !illusion
    && config.relic === "Mistburn"
    && Number(config.boons?.might || 0) >= 10
  ) {
    chance += 0.1;
  }
  if (
    traits.has("Flow of Time")
    && config.boons?.alacrity
    && (source === "Player" || source === "Clone" || source === "Phantasm")
  ) chance += 0.15;
  if (!illusion && traits.has("Quiet Intensity") && config.boons?.fury) {
    chance += 0.15;
  }
  if (source === "Phantasm" && traits.has("Phantasmal Fury")) {
    chance += config.specialization === "Virtuoso" ? 0.4 : 0.25;
  }
  return clamp(chance, 0, 1);
}

/**
 * Calculates condition duration multiplier for a condition type.
 * Base: expertise/1500 + conditionDurationBonus. Confusion+Malicious Sorcery: +25%.
 * Clamped [1, 2] (no duration reduction; max 100% extension).
 * @param {string} name - Condition name (e.g., "Burning", "Confusion")
 * @param {Object} stats - Calculated stats object with expertise/duration bonuses
 * @param {Set} traits - Selected traits
 * @param {number} extraBonus - Additional duration bonus (default 0)
 * @returns {number} Duration multiplier [1, 2]
 */
function durationMultiplier(name, stats, traits, extraBonus = 0) {
  const professionBonus =
    name === "Confusion" && traits.has("Malicious Sorcery") ? 0.25 : 0;
  return gw2ConditionDurationMultiplier(
    name,
    stats,
    Number(extraBonus || 0) + professionBonus,
  );
}

const SCHEDULER_MODEL = Object.freeze({
  AMBUSH_ATTACKS,
  ARISTOCRACY_SKILLS,
  AUTOATTACK_CHAINS,
  BLIND_SKILLS,
  CLONE_ATTACKS,
  CONDITION_FORMULAS,
  CONTINUUM_UNAFFECTED_COOLDOWN_IDS,
  CONTROL_SKILLS,
  EPSILON,
  INSTRUMENTS,
  PEITHA_SKILLS,
  PHANTASM_ATTACK_TIMINGS,
  PHANTASM_NAME_BY_SKILL,
  SHATTERS,
  TRAIT_DAMAGE,
  adjustedCooldown,
  allSkills,
  autoattackChainPositions,
  baseCriticalChance,
  byName,
  clamp,
  conditionName,
  flipSkillsByParent,
  getResourceDefinition,
  skillAvailable,
  skillsById,
  skillsByName,
});

const RESOLVER_QUERY_MODEL = Object.freeze({
  THORNS_CONDITION_DAMAGE,
  clamp,
  durationMultiplier,
  qualifyingIcdEvents,
  sigilSet,
  staticAttributes,
  thornsStacksAt,
});

function resolveEvents(config, traits, scheduler, horizon) {
  scheduler.advanceTo(horizon);
  const events = scheduler.events
    .filter(event => event.at <= horizon + EPSILON)
    .map(event => ({
      ...event,
      source: event.source || "System",
      sourceId:
        event.sourceId
        ?? event.skillId
        ?? event.skillName
        ?? event.name
        ?? event.type,
    }));
  const query = buildResolverQuery(
    config,
    traits,
    events,
    RESOLVER_QUERY_MODEL,
  );
  const stream = buildScheduledEventStream({
    events,
    rotationEndTime: horizon,
    resolverHandoff: {
      resource: getResourceDefinition(config.specialization),
      activeWeaponSet: scheduler.state.activeWeaponSet,
      hasExplicitCombatStart:
        scheduler.state.profession.hasExplicitCombatStart,
      combatStartTime: scheduler.state.profession.combatStartTime,
      cloneDeaths: [...scheduler.cloneDeaths],
      warnings: [...scheduler.warnings],
    },
  });

  return resolveScheduledStream({
    stream,
    config,
    traits,
    query,
    helpers: {
      conditionName,
      skillsById: mesmerCatalog.skillsById,
      skillsByName,
      weaponStrength,
    },
  });
}

function createCanonicalEndState(common, profession) {
  const endState = { ...common, profession };
  // Temporary source compatibility for existing consumers. Profession fields
  // are non-enumerable so persisted/canonical results expose only
  // endState.profession.
  for (const key of Object.keys(profession)) {
    if (Object.hasOwn(endState, key)) continue;
    Object.defineProperty(endState, key, {
      configurable: false,
      enumerable: false,
      get: () => endState.profession[key],
    });
  }
  return endState;
}

/**
 * Simulates a repeatable rotation (cycles looping until horizon or MAX_ACTIONS limit).
 * Used for benchmark loops; automatically waits for cooldowns between cycles.
 * Returns damage/condition results from scheduled events.
 * @param {Array<number>} rotation - Skill IDs to cast in sequence (repeats)
 * @param {Object} userConfig - Config overrides (merged with defaults)
 * @returns {Object} Simulation results with damage, conditions, warnings
 */
export function simulateRotation(rotation, userConfig = {}) {
  const defaults = createDefaultConfig();
  const config = prepareSimulationConfig(defaults, userConfig);
  const horizon = clamp(Number(config.duration || 30), 1, 600);
  const traits = selectedTraitSet(config);
  const scheduler = createScheduler(config, traits, horizon, SCHEDULER_MODEL);
  const ids = (rotation || []).map(Number).filter(Number.isFinite);

  if (!ids.length) {
    scheduler.warnings.push("The rotation is empty.");
    return resolveEvents(config, traits, scheduler, horizon);
  }

  let actionCount = 0;
  let cursor = 0;
  let cycleStart = 0;
  while (scheduler.state.time < horizon - EPSILON && actionCount < MAX_ACTIONS) {
    const id = ids[cursor % ids.length];
    const skill = skillsById.get(id);
    if (!skill) {
      scheduler.warnings.push(`Unknown skill id ${id}.`);
    } else {
      scheduler.cast(skill);
    }
    cursor += 1;
    actionCount += 1;

    if (cursor % ids.length === 0) {
      if (scheduler.state.time <= cycleStart + EPSILON) {
        const readyTimes = [...scheduler.state.cooldowns.values()].filter(
          (ready) => ready > scheduler.state.time + EPSILON,
        );
        const nextReady = readyTimes.length
          ? Math.min(...readyTimes)
          : scheduler.state.time + 0.1;
        scheduler.state.time = Math.min(horizon, nextReady);
        scheduler.advanceTo(scheduler.state.time);
      }
      cycleStart = scheduler.state.time;
    }
  }
  if (actionCount >= MAX_ACTIONS) {
    scheduler.warnings.push("Simulation stopped at the action safety limit.");
  }
  return resolveEvents(config, traits, scheduler, horizon);
}

/**
 * Simulates a single sequence of actions (builder mode, no looping).
 * Supports: skill names, __combat_start marker, __wait actions, concurrent casts (offset).
 * Returns: damage/conditions, step timeline, cooldowns/ammo/resource at end.
 * Used by UI to show state after last queued cast.
 * @param {Array<string|Object>} rotation - Sequence: skill names or {name, offset, interruptMs}
 * @param {Object} userConfig - Config overrides
 * @returns {Object} Simulation results + steps (timeline) + endState (cooldowns/ammo/resource)
 */
export function simulateSequence(rotation, userConfig = {}) {
  const defaults = createDefaultConfig();
  const config = prepareSimulationConfig(defaults, userConfig, {
    duration: 600,
  });
  const traits = selectedTraitSet(config);
  const scheduler = createScheduler(config, traits, 600, SCHEDULER_MODEL);
  const steps = [];
  let previousDisplayStart = 0;
  const sequence = normalizeRotation(rotation, mesmerCatalog)
    .map(command => toLegacyRotationEntry(command, mesmerCatalog));

  for (let ri = 0; ri < sequence.length; ri += 1) {
    const item = { ...sequence[ri] };

    if (item.name === "__combat_start") {
      const combatStart = scheduler.state.time;
      scheduler.state.profession.hasExplicitCombatStart = true;
      scheduler.state.profession.combatStartTime = combatStart;
      scheduler.events.push({ type: "combat_start", at: combatStart });
      steps.push({
        ri,
        skill: "Combat Start",
        start: Math.round(combatStart * 1000),
        end: Math.round(combatStart * 1000),
      });
      previousDisplayStart = combatStart;
      continue;
    }
    if (item.name === "__wait") {
      const start = scheduler.state.time;
      scheduler.state.time += Math.max(0, Number(item.waitMs || 0)) / 1000;
      scheduler.advanceTo(scheduler.state.time);
      steps.push({
        ri,
        skill: "Wait",
        start: Math.round(start * 1000),
        end: Math.round(scheduler.state.time * 1000),
      });
      previousDisplayStart = start;
      continue;
    }

    const skill = skillsByName.get(item.name);
    if (!skill) {
      scheduler.warnings.push(`Unknown skill "${item.name}".`);
      continue;
    }

    // A concurrent ("weave") cast overlaps the previous command's cast window.
    // An ammo mantra's flip (Power Spike) is only armed once its parent mantra's
    // channel finishes, so weaving it before that arm time — however many instant
    // skills are chained into the channel first — would display it before it is
    // castable. Detect that against the flip's actual arm time (not just the
    // preceding skill) and record it as invalid without simulating it.
    const concurrentWeave =
      item.offset != null && ri > 0 && Number(skill.activation || 0) === 0;
    if (concurrentWeave && skill.flipParent && skill.ammo) {
      const flipState =
        scheduler.state.profession.availableFlips.get(skill.name);
      const displayStart =
        previousDisplayStart + Math.max(1, Number(item.offset)) / 1000;
      const armedInTime =
        flipState && displayStart >= (flipState.availableAt || 0) - EPSILON;
      if (!armedInTime) {
        const startMs = Math.round(displayStart * 1000);
        steps.push({
          ri,
          skill: skill.name,
          start: startMs,
          end: startMs,
          actualStart: startMs,
          fullCastMs: 0,
          interrupted: false,
          invalid: true,
          invalidReason: flipState
            ? `${skill.name} cannot be queued while ${skill.flipParent} is channeling.`
            : `${skill.name} is unavailable — channel ${skill.flipParent} first.`,
        });
        scheduler.warnings.push(
          flipState
            ? `${skill.name} skipped: ${skill.flipParent} is still channeling.`
            : `${skill.name} skipped: ${skill.flipParent} must be channeled first.`,
        );
        continue;
      }
    }

    const actionCount = scheduler.events.length;
    const beforeCastTime = scheduler.state.time;
    const pendingBeforeCast =
      new Set(scheduler.state.profession.pendingResources);
    const ammoRechargeBeforeCast =
      scheduler.state.ammo.get(skill.id)?.nextRechargeAt ?? null;
    scheduler.cast(skill);
    let action = scheduler.events
      .slice(actionCount)
      .find(event => event.type === "action" && event.name === skill.name);
    if (!action) continue;

    const isConcurrent = item.offset != null && ri > 0 && Number(skill.activation || 0) === 0;
    const desiredStart = isConcurrent
      ? previousDisplayStart + Math.max(1, Number(item.offset)) / 1000
      : action.at;
    if (isConcurrent) {
      const delta = desiredStart - action.at;
      for (const event of scheduler.events.slice(actionCount)) {
        if (Number.isFinite(event.at)) event.at += delta;
        if (Number.isFinite(event.endsAt)) event.endsAt += delta;
        if (Number.isFinite(event.expiresAt)) event.expiresAt += delta;
      }
      for (const pending of scheduler.state.profession.pendingResources) {
        if (!pendingBeforeCast.has(pending)) pending.at += delta;
      }
      scheduler.state.profession.pendingResources.sort((a, b) => a.at - b.at);
      if (scheduler.state.cooldowns.has(skill.id)) {
        scheduler.state.cooldowns.set(
          skill.id,
          scheduler.state.cooldowns.get(skill.id) + delta,
        );
      }
      const castAmmo = scheduler.state.ammo.get(skill.id);
      if (
        castAmmo
        && ammoRechargeBeforeCast == null
        && castAmmo.nextRechargeAt != null
      ) {
        castAmmo.nextRechargeAt += delta;
      }
      if (
        skill.name === "Continuum Split" &&
        scheduler.state.profession.continuum
      ) {
        const continuum = scheduler.state.profession.continuum;
        continuum.expiresAt += delta;
        if (continuum.splitReady) continuum.splitReady += delta;
        for (const [id, remaining] of continuum.remainingCooldowns) {
          const shiftedRemaining = remaining - delta;
          if (shiftedRemaining > EPSILON) {
            continuum.remainingCooldowns.set(id, shiftedRemaining);
          } else {
            continuum.remainingCooldowns.delete(id);
          }
        }
        for (const ammo of continuum.ammo.values()) {
          if (ammo.nextRechargeRemaining != null) {
            ammo.nextRechargeRemaining = Math.max(
              0,
              ammo.nextRechargeRemaining - delta,
            );
          }
        }

        const previousStep = steps.at(-1);
        const splitEndsBeforePreviousCast =
          previousStep &&
          action.endsAt < previousStep.end / 1000 - EPSILON;
        if (splitEndsBeforePreviousCast) {
          const previousSkill = skillsByName.get(previousStep.skill);
          if (previousSkill) {
            continuum.remainingCooldowns.delete(previousSkill.id);
            const previousAmmo = continuum.ammo.get(previousSkill.id);
            if (previousAmmo) {
              previousAmmo.charges = Math.min(
                previousAmmo.maximum,
                previousAmmo.charges + 1,
              );
              if (previousAmmo.charges === previousAmmo.maximum) {
                previousAmmo.nextRechargeRemaining = null;
              }
            }
          }
        }
      }
      // A concurrent instant can be placed after a very short preceding action.
      // Keep the scheduler at the later end so delayed effects (such as Mirror
      // Images clone creation) are flushed and available to the next command.
      scheduler.state.time = Math.max(beforeCastTime, action.endsAt);
      action = scheduler.events
        .slice(actionCount)
        .find(event => event.type === "action" && event.name === skill.name);
    }

    const actualStart = action.at;
    let actualEnd = action.endsAt;
    const fullCastMs = Math.max(0, Math.round((actualEnd - actualStart) * 1000));
    const interruptMs = item.interruptMs ?? skill.defaultInterruptMs;
    if (interruptMs != null) {
      const interruptedEnd = Math.min(
        actualEnd,
        actualStart + Math.max(1, Number(interruptMs)) / 1000,
      );
      if (interruptedEnd < actualEnd) {
        const remappedConditions = skill.applyConditionsOnInterrupt
          ? scheduler.events
              .slice(actionCount)
              .filter(event =>
                event.type === "condition" &&
                event.skillName === skill.name &&
                event.at > interruptedEnd + EPSILON
              )
              .map(event => ({ ...event, at: interruptedEnd }))
          : [];
        const kept = [
          ...scheduler.events
            .slice(actionCount)
            .filter(event => event === action || event.at <= interruptedEnd + EPSILON),
          ...remappedConditions,
        ];
        scheduler.events.splice(
          actionCount,
          scheduler.events.length - actionCount,
          ...kept,
        );
        scheduler.state.profession.pendingResources =
          scheduler.state.profession.pendingResources
          .filter((pending) =>
            pendingBeforeCast.has(pending) ||
            pending.at <= interruptedEnd + EPSILON
          );
        action.endsAt = interruptedEnd;
        actualEnd = interruptedEnd;
        scheduler.state.time = interruptedEnd;
        const castAmmo = scheduler.state.ammo.get(skill.id);
        if (
          castAmmo
          && ammoRechargeBeforeCast == null
          && castAmmo.nextRechargeAt != null
        ) {
          castAmmo.nextRechargeAt =
            interruptedEnd + castAmmo.rechargeDuration;
          if (castAmmo.charges === 0) {
            scheduler.state.cooldowns.set(skill.id, castAmmo.nextRechargeAt);
          }
        } else if (scheduler.state.cooldowns.has(skill.id)) {
          scheduler.state.cooldowns.set(
            skill.id,
            interruptedEnd + adjustedCooldown(skill, config),
          );
        }
      }
    }

    const displayStart = isConcurrent ? desiredStart : actualStart;
    const shownCastMs = Math.max(0, Math.round((actualEnd - actualStart) * 1000));
    steps.push({
      ri,
      skill: skill.name,
      start: Math.round(displayStart * 1000),
      end: Math.round(displayStart * 1000 + shownCastMs),
      actualStart: Math.round(actualStart * 1000),
      fullCastMs,
      interrupted: shownCastMs < fullCastMs,
    });
    previousDisplayStart = displayStart;
  }

  const endTime = scheduler.state.time;
  // Resource gains are scheduled a tiny epsilon after the hit to preserve
  // event ordering. Flush that boundary without extending the displayed cast.
  scheduler.advanceTo(endTime + EPSILON * 2);
  const result = resolveEvents(config, traits, scheduler, Math.max(endTime, 0.001));
  const cooldowns = {};
  for (const [id, readyAt] of scheduler.state.cooldowns.entries()) {
    const skill = skillsById.get(id);
    if (!skill) continue;
    cooldowns[skill.name] = {
      readyAt: Math.round(readyAt * 1000),
      remaining: Math.max(0, Math.round((readyAt - endTime) * 1000)),
    };
  }
  const ammo = {};
  for (const [id, value] of scheduler.state.ammo.entries()) {
    const skill = skillsById.get(id);
    if (!skill) continue;
    ammo[skill.name] = {
      charges: value.charges,
      maximum: value.maximum,
      nextChargeAt:
        value.nextRechargeAt == null
          ? 0
          : Math.round(value.nextRechargeAt * 1000),
      remaining:
        value.nextRechargeAt == null
          ? 0
          : Math.max(0, Math.round((value.nextRechargeAt - endTime) * 1000)),
    };
  }
  const resourceDefinition = getResourceDefinition(config.specialization);
  const resource = resourceDefinition.singular === "clone"
    ? scheduler.state.profession.clones.length
    : scheduler.state.profession.numericResource;
  const availableFlips = {};
  for (const [name, flip] of scheduler.state.profession.availableFlips) {
    if (flip.expiresAt < endTime - EPSILON) continue;
    // Ammo mantras (Power Spike) stay armed until emptied, so they have no
    // finite expiry; mark them persistent and leave the timers null.
    const persistent = !Number.isFinite(flip.expiresAt);
    availableFlips[name] = {
      availableAt: Math.round(flip.availableAt * 1000),
      expiresAt: persistent ? null : Math.round(flip.expiresAt * 1000),
      remaining: persistent
        ? null
        : Math.max(0, Math.round((flip.expiresAt - endTime) * 1000)),
      persistent,
    };
  }
  const autoattackChains = Object.fromEntries(
    Object.keys(AUTOATTACK_CHAINS).map((root) => [
      root,
      scheduler.state.profession.autoattackChains.get(root) || root,
    ]),
  );

  const professionEndState = {
    resource,
    resourceDefinition,
    clarityRemaining: Math.max(
      0,
      Math.round(
        (scheduler.state.profession.clarityUntil - endTime) * 1000,
      ),
    ),
    counterspellAvailable:
      scheduler.state.profession.counterspellAvailable,
    availableAmbush:
      scheduler.state.profession.ambushSource
      && scheduler.state.profession.ambushUntil > endTime + EPSILON
        ? {
            name: AMBUSH_ATTACKS[
              scheduler.state.activeWeaponSet === 1
                ? config.primaryWeapon
                : config.weaponSet2Primary || config.primaryWeapon
            ]?.name || "",
            source: scheduler.state.profession.ambushSource,
            expiresAt: Math.round(
              scheduler.state.profession.ambushUntil * 1000,
            ),
            remaining: Math.max(
              0,
              Math.round(
                (scheduler.state.profession.ambushUntil - endTime) * 1000,
              ),
            ),
          }
        : null,
    availableFlips,
    autoattackChains,
    continuumActive: Boolean(scheduler.state.profession.continuum),
    continuumRemaining: scheduler.state.profession.continuum
      ? Math.max(
        0,
        Math.round(
          (scheduler.state.profession.continuum.expiresAt - endTime) * 1000,
        ),
      )
      : 0,
  };

  return {
    ...result,
    duration: endTime,
    steps,
    endState: createCanonicalEndState({
      time: Math.round(endTime * 1000),
      cooldowns,
      ammo,
      activeWeaponSet: scheduler.state.activeWeaponSet,
    }, professionEndState),
  };
}

/**
 * Looks up a skill by its numeric ID.
 * @param {number} id - Skill ID
 * @returns {Object|undefined} Skill object or undefined if not found
 */
export function skillById(id) {
  return skillsById.get(Number(id));
}

/**
 * Returns all skills available for a given config.
 * Filters by: environment, specialization, type, weaponmaster training.
 * @param {Object} config - Simulation config with specialization/weaponmasterTraining
 * @returns {Array<Object>} Array of available skill objects
 */
export function availableSkills(config) {
  return allSkills.filter((skill) => skillAvailable(skill, config));
}

/**
 * Calculates static attributes (power, precision, etc.) for a config.
 * Merges user config with defaults, then applies might/boon bonuses.
 * @param {Object} config - User config (partial)
 * @returns {Object} Calculated attributes with all bonuses applied
 */
export function calculatedAttributes(config) {
  const defaults = createDefaultConfig();
  const merged = prepareSimulationConfig(defaults, config);
  return staticAttributes(merged, selectedTraitSet(merged));
}
