import { EPSILON } from "../engine/clock.js";
import { isInternalCooldownReady } from "../engine/internal-cooldown.js";
import { permanentTargetConditionStacks } from "./target-state.js";
import { gw2SigilSet } from "./runtime-rules.js";

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

function qualifyingIcdEvents(events, type, cooldown) {
  const activations = [];
  let readyAt = 0;
  for (const event of events) {
    if (
      event.type !== type
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
  config,
  events,
  sigilSet = gw2SigilSet,
} = {}) {
  const buffEvents = events.filter(event => event.type === "buff");
  const weaponSetEvents = events.filter(event => event.type === "weapon_set");
  const cooldownEvents = events.filter(
    event => event.type === "action" || event.type === "cooldown_snapshot",
  );
  const aristocracyTriggers = qualifyingIcdEvents(
    events,
    "weakness_vulnerability",
    1,
  );

  const aristocracyStacksAt = time => {
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

  const timedStacks = (kind, time, duration, maximum) =>
    clamp(
      buffEvents
        .filter(event =>
          event.kind === kind
          && event.at <= time + EPSILON
          && event.at + (event.duration || duration) > time)
        .reduce((sum, event) => sum + Number(event.stacks || 1), 0),
      0,
      maximum,
    );

  const timedActive = (kind, time) =>
    buffEvents.some(event =>
      event.kind === kind
      && event.at <= time + EPSILON
      && event.at + event.duration > time);

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
    let activeSet = Number(config.startingWeaponSet) === 2 ? 2 : 1;
    for (const event of weaponSetEvents) {
      if (event.at > time + EPSILON) break;
      activeSet = event.weaponSet;
    }
    return activeSet;
  };

  const activeSigilSetAt = time =>
    sigilSet(config, activeWeaponSetAt(time));

  const skillOnCooldownAt = (skillId, time) => {
    let readyAt = 0;
    for (const event of cooldownEvents) {
      if (event.at > time + EPSILON) break;
      if (event.type === "action" && event.skillId === skillId) {
        if (event.at >= time - EPSILON) continue;
        readyAt = Number(event.rechargeReadyAt || 0);
      } else if (event.type === "cooldown_snapshot") {
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
