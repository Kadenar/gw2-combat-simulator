export const EVENT_SCHEMA_VERSION = 1;

/**
 * @typedef {"action"|"damage"|"condition"|"condition_tick"|"control"|"blind"|"weapon_set"|"proc"|string} SimulationEventType
 *
 * @typedef {object} SimulationEventBase
 * @property {SimulationEventType} type
 * @property {number} at
 * @property {string} source
 * @property {string|number} sourceId
 * @property {"player"|"summon"|"effect"|"unknown"} [actorType]
 *
 * @typedef {SimulationEventBase & {
 *   type: "damage",
 *   coefficient: number,
 *   hits?: number,
 *   canCrit?: boolean
 * }} DamageEvent
 *
 * @typedef {SimulationEventBase & {
 *   type: "condition",
 *   condition: string,
 *   stacks: number,
 *   duration: number
 * }} ConditionEvent
 *
 * @typedef {SimulationEventBase & {
 *   type: "action"|"combat_start"|"condition_tick"|"control"|"blind"|
 *     "weapon_set"|"proc"|"marker"|"resource"|"buff"|
 *     "weakness_vulnerability"|"peitha"
 * }} CommonEvent
 *
 * @typedef {DamageEvent|ConditionEvent|CommonEvent|SimulationEventBase} SimulationEvent
 */

export const COMMON_EVENT_TYPES = Object.freeze([
  "action",
  "combat_start",
  "damage",
  "condition",
  "condition_tick",
  "control",
  "blind",
  "weapon_set",
  "proc",
  "marker",
  "resource",
  "buff",
  "weakness_vulnerability",
  "peitha",
]);

/** @param {unknown} candidate */
export function assertSimulationEvent(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw new TypeError("Simulation event must be an object.");
  }
  const event = /** @type {Record<string, unknown>} */ (candidate);
  if (!String(event.type || "")) throw new Error("Event type is required.");
  if (!Number.isFinite(event.at)) throw new Error("Event at must be finite.");
  if (!String(event.source || "")) throw new Error("Event source is required.");
  if (event.sourceId === undefined || event.sourceId === null || event.sourceId === "") {
    throw new Error("Event sourceId is required.");
  }
  return /** @type {SimulationEvent} */ (candidate);
}

/** @param {SimulationEvent} event */
export function createEvent(event) {
  return Object.freeze({ schemaVersion: EVENT_SCHEMA_VERSION, ...assertSimulationEvent(event) });
}
