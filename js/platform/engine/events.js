/**
 * Canonical event schema shared by the platform scheduler and resolver.
 * Professions may add custom types, but every event crossing the boundary must
 * still satisfy this base shape.
 */
export const EVENT_SCHEMA_VERSION = 1;

/**
 * @typedef {"action"|"damage"|"condition"|"condition_tick"|"control"|"blind"|"weapon_set"|"sigil_swap"|"proc"|string} SimulationEventType
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
 *   coefficientModifiers?: ReadonlyArray<{
 *     kind: "target-health-below",
 *     threshold: number,
 *     multiplier: number
 *   }>,
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
 *     "weapon_set"|"sigil_swap"|"proc"|"marker"|"resource"|"buff"|
 *     "weakness_vulnerability"|"peitha"
 * }} CommonEvent
 *
 * @typedef {DamageEvent|ConditionEvent|CommonEvent|SimulationEventBase} SimulationEvent
 */

/**
 * Event types owned by the shared platform resolver.
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
  "sigil_swap",
  "proc",
  "marker",
  "resource",
  "buff",
  "weakness_vulnerability",
  "peitha",
]);

/**
 * Verifies that an arbitrary value satisfies the shared event contract.
 *
 * @param {unknown} candidate
 */
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

/**
 * Validates and freezes an event before it enters a scheduled event stream.
 *
 * @param {SimulationEvent} event
 */
export function createEvent(event) {
  const normalized = Object.fromEntries(
    Object.entries({
      schemaVersion: EVENT_SCHEMA_VERSION,
      ...assertSimulationEvent(event),
    }).filter(([, value]) => value !== undefined),
  );
  return Object.freeze(normalized);
}
