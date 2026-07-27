import { EPSILON } from "../engine/clock.js";
import { isInternalCooldownReady } from "../engine/internal-cooldown.js";
import { permanentTargetConditionStacks } from "./target-state.js";
import { gw2SigilSet } from "./runtime-rules.js";

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

function qualifyingIcdEvents(
  events,
  type,
  cooldown,
  earliestAt = -Infinity,
) {
  // Input is chronological; accepting an event advances the shared ICD window
  // before later candidates are considered.
  const activations = [];
  let readyAt = 0;
  for (const event of events) {
    if (
      event.type !== type
      || event.at < earliestAt - EPSILON
      || !isInternalCooldownReady(event.at, readyAt)
    ) continue;
    activations.push(event);
    readyAt = event.at + cooldown;
  }
  return activations;
}

/**
 * Common timestamp queries over scheduled GW2 events.
 */
export function createGw2TimelineIndex({
  config = {},
  events = [],
  sigilSet = gw2SigilSet,
} = {}) {
  // Timestamp ties follow scheduler causal order so derived events are queried
  // in the same order the resolver consumes them.
  const compareEvents = (left, right) =>
    left.at - right.at
    || Number(left.causalOrder ?? left.__order ?? 0)
      - Number(right.causalOrder ?? right.__order ?? 0);
  const insertOrdered = (target, event) => {
    if (
      target.length === 0
      || compareEvents(target[target.length - 1], event) <= 0
    ) {
      target.push(event);
      return;
    }
    let low = 0;
    let high = target.length;
    // Events are usually appended chronologically. Binary insertion handles
    // late-derived events without re-sorting every indexed collection.
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (compareEvents(target[middle], event) <= 0) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    target.splice(low, 0, event);
  };
  const indexed = {
    buff: [],
    weaponSet: [],
    cooldown: [],
    combatStart: [],
    weaknessVulnerability: [],
  };
  let indexedLength = 0;
  let revision = 0;
  let aristocracyRevision = -1;
  let cachedAristocracyTriggers = [];
  const resetIndex = () => {
    for (const values of Object.values(indexed)) values.length = 0;
    indexedLength = 0;
  };
  const refreshIndex = () => {
    // The source array is append-oriented. Shrinking it signals replacement and
    // rebuilds the index; same-length in-place mutation is outside the contract.
    if (events.length < indexedLength) resetIndex();
    if (events.length === indexedLength) return;
    while (indexedLength < events.length) {
      const event = events[indexedLength++];
      if (event.type === "buff") {
        insertOrdered(indexed.buff, event);
      }
      if (event.type === "weapon_set") {
        insertOrdered(indexed.weaponSet, event);
      }
      if (
        event.type === "action"
        || event.type === "cooldown_snapshot"
      ) {
        insertOrdered(indexed.cooldown, event);
      }
      if (event.type === "combat_start") {
        insertOrdered(indexed.combatStart, event);
      }
      if (event.type === "weakness_vulnerability") {
        insertOrdered(indexed.weaknessVulnerability, event);
      }
    }
    revision += 1;
  };
  const aristocracyTriggers = () => {
    refreshIndex();
    if (aristocracyRevision === revision) {
      return cachedAristocracyTriggers;
    }
    // Pre-combat weakness/vulnerability events cannot arm Aristocracy once an
    // explicit combat-start marker exists.
    const combatStartAt =
      indexed.combatStart[0]?.at
      ?? -Infinity;
    cachedAristocracyTriggers = qualifyingIcdEvents(
      indexed.weaknessVulnerability,
      "weakness_vulnerability",
      1,
      combatStartAt,
    );
    aristocracyRevision = revision;
    return cachedAristocracyTriggers;
  };

  const aristocracyStacksAt = time => {
    let stacks = 0;
    let expiresAt = -Infinity;
    for (const trigger of aristocracyTriggers()) {
      // Use state strictly before time. This prevents an event from benefiting
      // from a stack it is itself in the process of triggering.
      if (trigger.at >= time - EPSILON) break;
      if (trigger.at >= expiresAt - EPSILON) stacks = 0;
      // Each proc refreshes the eight-second window and caps at five stacks.
      stacks = Math.min(5, stacks + 1);
      expiresAt = trigger.at + 8;
    }
    return time < expiresAt - EPSILON ? stacks : 0;
  };

  const timedStacks = (kind, time, duration, maximum) => {
    refreshIndex();
    let stacks = 0;
    for (const event of indexed.buff) {
      if (event.at > time + EPSILON) break;
      if (
        event.kind === kind
        // Event duration wins; duration is a fallback for compact buff records.
        && event.at + (event.duration || duration) > time
      ) {
        stacks += Number(event.stacks || 1);
      }
    }
    return clamp(stacks, 0, maximum);
  };

  const timedActive = (kind, time) => {
    refreshIndex();
    for (const event of indexed.buff) {
      if (event.at > time + EPSILON) break;
      if (event.kind === kind && event.at + event.duration > time) {
        return true;
      }
    }
    return false;
  };

  const mightStacksAt = time => clamp(
    Number(config.boons?.might || 0) + timedStacks("might", time, 1, 25),
    0,
    25,
  );
  const furyActiveAt = time =>
    Boolean(config.boons?.fury) || timedActive("fury", time);
  const vigorActiveAt = time =>
    Boolean(config.boons?.vigor) || timedActive("vigor", time);
  const vulnerabilityStacksAt = time => clamp(
    permanentTargetConditionStacks(config, "Vulnerability")
      + timedStacks("target-vulnerability", time, 1, 25),
    0,
    25,
  );

  const activeWeaponSetAt = time => {
    refreshIndex();
    let activeSet = Number(config.startingWeaponSet) === 2 ? 2 : 1;
    for (const event of indexed.weaponSet) {
      if (event.at > time + EPSILON) break;
      // Same-timestamp swaps are visible to effects emitted after the swap.
      activeSet = event.weaponSet;
    }
    return activeSet;
  };

  const activeSigilSetAt = time =>
    sigilSet(config, activeWeaponSetAt(time));

  const skillOnCooldownAt = (skillId, time) => {
    refreshIndex();
    let readyAt = 0;
    for (const event of indexed.cooldown) {
      if (event.at > time + EPSILON) break;
      if (event.type === "action" && event.skillId === skillId) {
        // Query the state before an action at this exact timestamp; otherwise
        // the action would see the cooldown it is about to create.
        if (event.at >= time - EPSILON) continue;
        readyAt = Number(event.rechargeReadyAt || 0);
      } else if (event.type === "cooldown_snapshot") {
        // A snapshot replaces prior knowledge for the requested skill.
        readyAt = Number(event.cooldowns?.[skillId] || 0);
      }
    }
    return readyAt > time + EPSILON;
  };

  return Object.freeze({
    aristocracyStacksAt,
    timedStacks,
    timedActive,
    mightStacksAt,
    furyActiveAt,
    vigorActiveAt,
    vulnerabilityStacksAt,
    activeWeaponSetAt,
    activeSigilSetAt,
    skillOnCooldownAt,
  });
}
