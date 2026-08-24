/**
 * Canonical event schema shared by the platform scheduler and resolver.
 * Professions may add custom types, but every event crossing the boundary must
 * still satisfy this base shape.
 */
import type { QueuedEvent, SimulationActorType, SimulationEvent } from '../types.js';

export const EVENT_SCHEMA_VERSION = 1 as const;

const ACTOR_TYPES: ReadonlySet<SimulationActorType> = new Set(['player', 'summon', 'effect', 'unknown', 'phantasm']);
const LEGACY_EVENT_TYPES = new Set(['boon', 'cooldown_snapshot', 'self_condition']);

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Extracts the canonical queue timestamp while retaining legacy `time` event support. */
export function eventTimestamp(event: QueuedEvent): number {
  return Number(event.at ?? event.time ?? 0);
}

/** Returns finite causal metadata from either the canonical or legacy event-order field. */
export function eventCausalOrder(event: QueuedEvent): number | null {
  const order = Number(event.causalOrder ?? event.__order);
  return Number.isFinite(order) ? order : null;
}

/**
 * Event types owned by the shared platform resolver.
 */
export const COMMON_EVENT_TYPES = Object.freeze([
  'action',
  'aura',
  'combo',
  'combo_field',
  'combo_finisher',
  'combat_start',
  'damage',
  'condition',
  'condition_tick',
  'control',
  'blind',
  'weapon_set',
  'sigil_swap',
  'proc',
  'marker',
  'resource',
  'buff',
  'effect',
  'weakness_vulnerability',
  'peitha'
]);
const COMMON_EVENT_TYPE_SET = new Set(COMMON_EVENT_TYPES);

/**
 * Verifies that an arbitrary value satisfies the shared event contract.
 *
 * @param {unknown} candidate
 * @returns {SimulationEvent}
 */
export function assertSimulationEvent(candidate: unknown): SimulationEvent {
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError('Simulation event must be an object.');
  }

  const event = candidate as Record<string, unknown>;
  if (typeof event.type !== 'string' || !event.type) {
    throw new Error('Event type is required.');
  }

  if (!COMMON_EVENT_TYPE_SET.has(event.type) && !LEGACY_EVENT_TYPES.has(event.type) && !event.type.includes('.')) {
    throw new Error(`Unsupported simulation event type: ${event.type}.`);
  }

  if (!isFiniteNumber(event.at) || event.at < 0) {
    throw new Error('Event at must be a non-negative finite number.');
  }

  if (typeof event.source !== 'string' || !event.source) {
    throw new Error('Event source is required.');
  }

  if ((typeof event.sourceId !== 'string' && typeof event.sourceId !== 'number') || event.sourceId === '') {
    throw new Error('Event sourceId is required.');
  }

  if (event.schemaVersion !== undefined && event.schemaVersion !== EVENT_SCHEMA_VERSION) {
    throw new Error('Event schemaVersion is invalid.');
  }

  if (event.actorType !== undefined && !ACTOR_TYPES.has(event.actorType as SimulationActorType)) {
    throw new Error('Event actorType is invalid.');
  }

  if (event.activationId !== undefined && (typeof event.activationId !== 'string' || !event.activationId)) {
    throw new Error('Event activationId must be a non-empty string.');
  }

  if (
    event.weaponStrengthProfileId !== undefined &&
    (typeof event.weaponStrengthProfileId !== 'string' || !event.weaponStrengthProfileId)
  ) {
    throw new Error('Event weaponStrengthProfileId must be a non-empty string.');
  }

  if (event.weaponStrength !== undefined && !isFiniteNumber(event.weaponStrength)) {
    throw new Error('Event weaponStrength must be finite.');
  }

  if (event.type === 'damage') {
    if (event.didCrit !== undefined && typeof event.didCrit !== 'boolean') {
      throw new Error('Damage event didCrit must be boolean.');
    }

    const hasDamageValue = [event.coefficient, event.flatDamage, event.flatStrikeBase, event.flatStrikePowerCoeff].some(
      isFiniteNumber
    );
    if (!hasDamageValue) {
      throw new Error('Damage events require a finite coefficient or flat strike value.');
    }

    if (event.hits !== undefined && (!isFiniteNumber(event.hits) || !Number.isInteger(event.hits) || event.hits <= 0)) {
      throw new Error('Damage event hits must be a positive integer.');
    }
  }

  if (event.type === 'condition') {
    if (typeof event.condition !== 'string' || !event.condition) {
      throw new Error('Condition events require a condition.');
    }

    if (!isFiniteNumber(event.stacks) || event.stacks <= 0) {
      throw new Error('Condition event stacks must be positive.');
    }

    if (!isFiniteNumber(event.duration) || event.duration <= 0) {
      throw new Error('Condition event duration must be positive.');
    }
  }

  return candidate as SimulationEvent;
}

/**
 * Validates and freezes an event before it enters a scheduled event stream.
 *
 * @param {unknown} event
 * @returns {Readonly<SimulationEvent>}
 */
export function createEvent(event: unknown): Readonly<SimulationEvent> {
  const normalized = Object.fromEntries(
    Object.entries({
      schemaVersion: EVENT_SCHEMA_VERSION,
      ...assertSimulationEvent(event)
    }).filter(([, value]) => value !== undefined)
  );
  return Object.freeze(normalized as unknown as SimulationEvent);
}
