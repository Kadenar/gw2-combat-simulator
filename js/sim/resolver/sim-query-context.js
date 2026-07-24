/**
 * Builds resolver query context: indexable event lookups for damage calculation.
 * Provides functions to query buffs, weapons, Aristocracy stacks, instruments, stats at any timestamp.
 * Used during event resolution to apply multipliers, crit chance, condition duration, etc.
 *
 * @param {Object} config - Simulation config (stats, boons, relic, modifiers, target)
 * @param {Set} traits - Selected traits
 * @param {Array} events - All scheduled events (buffs, instruments, weapon sets, etc.)
 * @param {Object} model - Query model with EPSILON, duration/stack/stats helpers
 * @returns {Object} Query context: statsAt, critical, strikeMultiplier, conditionMultiplier, conditionDurationMultiplier, activeWeaponSetAt, timedStacks, instrumentsAt
 */
import {
  permanentTargetConditionStacks,
  targetHasPermanentCondition,
} from "../shared/sim-target-state.js";

export function buildResolverQuery(config, traits, events, model) {
  const {
    EPSILON,
    THORNS_CONDITION_DAMAGE,
    clamp,
    durationMultiplier,
    qualifyingIcdEvents,
    sigilSet,
    staticAttributes,
    thornsStacksAt,
  } = model;
  const base = staticAttributes(config, traits);
  const buffEvents = events.filter((event) => event.type === "buff");
  const instrumentEvents = events.filter((event) => event.type === "instrument");
  const weaponSetEvents = events.filter((event) => event.type === "weapon_set");
  const cooldownEvents = events.filter(
    (event) =>
      event.type === "action"
      || event.type === "cooldown_snapshot",
  );
  const aristocracyTriggers = qualifyingIcdEvents(
    events,
    "weakness_vulnerability",
    1,
  );

  /** Calculates Aristocracy relic stacks at time (max 5, 8s duration, resets on new trigger). */
  const aristocracyStacksAt = (time) => {
    let stacks = 0;
    let expiresAt = -Infinity;
    for (const trigger of aristocracyTriggers) {
      if (trigger.at >= time - EPSILON) break;
      if (trigger.at >= expiresAt - EPSILON) stacks = 0;
      stacks = Math.min(5, stacks + 1);
      expiresAt = trigger.at + 8;
    }
    return time < expiresAt - EPSILON ? stacks : 0;
  };

  /** Counts active buff stacks of a kind (filters by active duration, clamped to max). */
  const timedStacks = (kind, time, duration, maximum) =>
    clamp(
      buffEvents
        .filter(
          (event) =>
            event.kind === kind &&
            event.at <= time + EPSILON &&
            event.at + (event.duration || duration) > time,
        )
        .reduce((sum, event) => sum + Number(event.stacks || 1), 0),
      0,
      maximum,
    );

  /** Checks if a buff kind is active at time. */
  const timedActive = (kind, time) =>
    buffEvents.some(
      (event) =>
        event.kind === kind &&
        event.at <= time + EPSILON &&
        event.at + event.duration > time,
    );

  /** Gets active instruments at time. */
  const instrumentsAt = (time) =>
    instrumentEvents.filter(
      (event) => event.at <= time + EPSILON && event.expiresAt > time,
    );

  /** Gets active weapon set at time (defaults to 1). */
  const activeWeaponSetAt = (time) => {
    let activeSet = 1;
    for (const event of weaponSetEvents) {
      if (event.at > time + EPSILON) break;
      activeSet = event.weaponSet;
    }
    return activeSet;
  };

  /** Gets active sigil set at time. */
  const activeSigilSetAt = (time) =>
    sigilSet(config, activeWeaponSetAt(time));

  /**
   * Checks whether a skill is recharging at a timestamp. Action events carry
   * their calculated ready time; Continuum Shift emits the restored cooldown
   * snapshot so signet passives resume with the restored state.
   */
  const skillOnCooldownAt = (skillId, time) => {
    let readyAt = 0;
    for (const event of cooldownEvents) {
      if (event.at > time + EPSILON) break;
      if (event.type === "action" && event.skillId === skillId) {
        // A condition landing as the prior cast ends resolves before an
        // instant follow-up action beginning at the same timestamp.
        if (event.at >= time - EPSILON) continue;
        readyAt = Number(event.rechargeReadyAt || 0);
      } else if (event.type === "cooldown_snapshot") {
        readyAt = Number(event.cooldowns?.[skillId] || 0);
      }
    }
    return readyAt > time + EPSILON;
  };

  /**
   * Calculates effective stats at time: applies Fortissimo (+4% per instrument), Thorns relic condition damage, Fencer stacks.
   * @param {number} time - Timestamp
   * @returns {Object} Stats with all buffs: {power, precision, ferocity, conditionDamage, expertise, conditionDurationBonus, conditionDurationBonuses}
   */
  const statsAt = (time) => {
    const instruments = instrumentsAt(time);
    const fortissimo =
      traits.has("Fortissimo") && instruments.length
        ? 1 + instruments.length * 0.04
        : 1;
    const thornsConditionDamage =
      config.relic === "Thorns"
        ? thornsStacksAt(time) * THORNS_CONDITION_DAMAGE
        : 0;
    const midnightExpertise =
      config.selectedSkills?.includes("Signet of Midnight")
      && skillOnCooldownAt(10234, time)
        ? 180
        : 0;
    const dominationConditionDamage =
      config.selectedSkills?.includes("Signet of Domination")
      && skillOnCooldownAt(10232, time)
        ? 180
        : 0;
    return {
      power: base.power * fortissimo,
      precision: base.precision * fortissimo,
      ferocity:
        (base.ferocity +
          timedStacks("fencer", time, 6, 10) * 15) *
        fortissimo,
      conditionDamage:
        (
          base.conditionDamage
          + thornsConditionDamage
          - dominationConditionDamage
        ) * fortissimo,
      expertise: (base.expertise - midnightExpertise) * fortissimo,
      conditionDurationBonus: base.conditionDurationBonus,
      conditionDurationBonuses: base.conditionDurationBonuses,
    };
  };

  /**
   * Calculates critical hit chance and damage multiplier for an event at time.
   * Chance: base 5% + (precision-1000)/2100 + fury/Mistburn/Flow of Time/Quiet Intensity/Phantasmal Fury.
   * Damage: 1.5 + ferocity/1500 + Superiority Complex/Danger Time bonuses.
   * @param {Object} event - Damage event (source, blade, etc.)
   * @param {number} time - Timestamp
   * @returns {Object} {chance [0,1], damage multiplier}
   */
  const critical = (event, time) => {
    const stats = statsAt(time);
    const illusion = event.source === "Clone" || event.source === "Phantasm";
    let chance = 0.05 + Math.max(0, stats.precision - 1000) / 2100;
    if (!illusion) {
      chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
      chance +=
        Number(activeSigilSetAt(time).criticalChanceBonus || 0) / 100;
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
      && (event.source === "Player"
        || event.source === "Clone"
        || event.source === "Phantasm")
    ) chance += 0.15;
    if (!illusion && traits.has("Quiet Intensity") && config.boons?.fury) {
      chance += 0.15;
    }
    if (event.source === "Phantasm" && traits.has("Phantasmal Fury")) {
      chance += config.specialization === "Virtuoso" ? 0.4 : 0.25;
    }
    chance = clamp(chance, 0, 1);

    let criticalDamage = 1.5 + stats.ferocity / 1500;
    if (traits.has("Superiority Complex")) criticalDamage += 0.15;
    if (
      traits.has("Danger Time")
      && targetHasPermanentCondition(config, "Slow")
    ) {
      criticalDamage += 0.05;
    }
    return { chance, damage: criticalDamage };
  };

  /**
   * Calculates common damage multiplier (applies to strikes and conditions): Vulnerability, Nomad's Endurance,
   * Compounding Power, Phantom Pain, Deadly Blades, Illusionary Membrane, Lute (Fortissimo), Altered Chord.
   * @param {number} time - Timestamp
   * @param {boolean} condition - If true, applies condition-specific modifiers
   * @returns {number} Multiplier ≥ 1
   */
  const commonMultiplier = (time, condition = false) => {
    const vulnerability = clamp(
      permanentTargetConditionStacks(config, "Vulnerability"),
      0,
      25,
    );
    // Vulnerability increases both strike and condition damage, so it stays in
    // the common multiplier. Fragility and Vicious Expression are strike-only
    // and live in strikeMultiplier instead.
    let multiplier = 1 + vulnerability / 100;
    if (traits.has("Nomad's Endurance") && config.boons?.vigor) {
      multiplier *= condition ? 1.05 : 1.1;
    }
    multiplier *=
      1 + timedStacks("compounding", time, 8, 5) * 0.01;
    multiplier *=
      1 +
      timedStacks("phantom-pain", time, 10, 4) *
        (condition ? 0.05 : 0.0625);
    if (timedActive("deadly-blades", time)) {
      multiplier *= condition ? 1.1 : 1.05;
    }
    if (condition && timedActive("illusionary-membrane", time)) {
      multiplier *= 1.07;
    }

    const lutePlaying = instrumentsAt(time).some(
      (event) => event.instrument === "Lute",
    );
    if (lutePlaying) {
      multiplier *= 1.1;
      if (traits.has("Shredding")) multiplier *= 1.15;
    }
    if (!condition && timedActive("altered-chord", time)) multiplier *= 1.25;
    return multiplier;
  };

  /**
   * Calculates strike damage multiplier: common + Fragility + Vicious Expression + phantasm bonuses + Mental Anguish + Infinite Forge + Mental Focus.
   * @param {Object} event - Damage event with source (Player/Clone/Phantasm), blade, shatter, multiplier props
   * @param {number} time - Timestamp
   * @returns {number} Strike multiplier
   */
  const strikeMultiplier = (event, time) => {
    let multiplier =
      commonMultiplier(time, false) *
      Number(config.modifiers?.strike || 1) *
      Number(activeSigilSetAt(time).strike || 1);
    // Fragility: +0.5% strike damage per stack of Vulnerability (on top of the
    // base 1%/stack from Vulnerability itself). Strike-only and does not affect
    // phantasm strikes.
    if (traits.has("Fragility") && event.source !== "Phantasm") {
      const vulnerability = clamp(
        permanentTargetConditionStacks(config, "Vulnerability"),
        0,
        25,
      );
      multiplier *= 1 + vulnerability * 0.005;
    }
    // Vicious Expression: +10% strike damage for you and your illusions, further
    // increased by +15% against foes without boons. Strike-only.
    if (traits.has("Vicious Expression")) {
      multiplier *= 1.1;
      if (config.target?.boonless) multiplier *= 1.15;
    }
    if (event.source === "Phantasm") {
      if (traits.has("Empowered Illusions")) multiplier *= 1.15;
      if (traits.has("Phantasmal Force")) {
        multiplier *= 1 + clamp(config.boons?.might || 0, 0, 25) * 0.01;
      }
    }
    if (event.shatter && traits.has("Mental Anguish")) {
      multiplier *= config.target?.activatingSkills ? 1.25 : 1.5;
    }
    if (event.blade && traits.has("Infinite Forge")) multiplier *= 1.07;
    if (
      traits.has("Mental Focus") &&
      config.target?.nearby &&
      event.source === "Player"
    ) {
      multiplier *= 1.05;
    }
    return multiplier * Number(event.multiplier || 1);
  };

  /**
   * Calculates condition damage multiplier: common + Bloodsong (+25% Bleeding).
   * @param {string} name - Condition name (e.g., "Bleeding")
   * @param {number} time - Timestamp
   * @returns {number} Condition multiplier
   */
  const conditionMultiplier = (name, time, application = {}) => {
    let multiplier =
      commonMultiplier(time, true) *
      Number(config.modifiers?.condition || 1) *
      Number(activeSigilSetAt(time).condition || 1);
    // EVTC attributes damaging-condition ticks to the Mesmer, including
    // conditions originally applied by illusions. Owner-side condition
    // modifiers such as Compounding Power and Bursting affect those ticks,
    // even though illusions do not inherit the same modifiers for strikes.
    if (name === "Bleeding" && traits.has("Bloodsong")) multiplier *= 1.25;
    return multiplier;
  };

  /**
   * Calculates condition duration multiplier: base expertise/1500 + bonuses + Aristocracy relic + sigil bonuses.
   * Clamped [1, 2] (no reduction; max 100% extension).
   * @param {string} name - Condition name
   * @param {number} time - Timestamp
   * @param {Object} stats - Pre-calculated stats (optional; computed if omitted)
   * @returns {number} Duration multiplier [1, 2]
   */
  const conditionDurationMultiplier = (
    name,
    time,
    stats = statsAt(time),
    application = {},
  ) => {
    const aristocracyBonus =
      config.relic === "Aristocracy"
        ? aristocracyStacksAt(time) * 0.03
        : 0;
    const activeSigils = activeSigilSetAt(time);
    const sigilBonus =
      (
        Number(activeSigils.conditionDurationBonus || 0) +
        Number(activeSigils.conditionDurationBonuses?.[name] || 0)
      ) / 100;
    return durationMultiplier(
      name,
      stats,
      traits,
      aristocracyBonus + sigilBonus,
    );
  };

  return {
    statsAt,
    critical,
    strikeMultiplier,
    conditionMultiplier,
    conditionDurationMultiplier,
    activeWeaponSetAt,
    timedStacks,
    instrumentsAt,
  };
}
