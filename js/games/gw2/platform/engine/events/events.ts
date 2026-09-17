import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2DamageCalculation } from '#gw2/platform/resolver/hit-resolution.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

/**
 * Canonical event schema shared by the platform scheduler and resolver.
 * Professions may add custom types, but every event crossing the boundary must
 * still satisfy this base shape.
 */

export const EVENT_SCHEMA_VERSION = 1 as const;

const ACTOR_TYPES: ReadonlySet<SimulationActorType> = new Set(['player', 'summon', 'effect', 'environment', 'unknown']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
  'condition_buffer',
  'condition_tick',
  'control',
  'blind',
  'shadowstep',
  'weapon_set',
  'sigil_swap',
  'proc',
  'marker',
  'resource',
  'buff',
  'boon_extension',
  'cooldown_snapshot',
  'self_condition',
  'peitha'
] as const);
const COMMON_EVENT_TYPE_SET: ReadonlySet<string> = new Set(COMMON_EVENT_TYPES);

/**
 * Verifies that an arbitrary value satisfies the shared event contract.
 */
export function assertSimulationEvent(candidate: unknown): SimulationEvent {
  if (!candidate || typeof candidate !== 'object') {
    throw new TypeError('Simulation event must be an object.');
  }

  const event = candidate as Record<string, unknown>;
  if (typeof event.type !== 'string' || !event.type) {
    throw new Error('Event type is required.');
  }

  if (!COMMON_EVENT_TYPE_SET.has(event.type) && !event.type.includes('.')) {
    throw new Error(`Unsupported simulation event type: ${event.type}.`);
  }

  if (!isFiniteNumber(event.at) || event.at < 0) {
    throw new Error('Event at must be a non-negative finite number.');
  }

  timeKey(event.at);

  // Extension commands carry finite seconds and one supported recipient scope across the phase boundary.
  if (
    event.type === 'boon_extension' &&
    (!isFiniteNumber(event.duration) ||
      event.duration < 0 ||
      (event.extensionAudience !== undefined && !['self', 'all'].includes(String(event.extensionAudience))))
  ) {
    throw new TypeError('Boon extensions require a finite non-negative duration and self/all audience.');
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

  // Every producer must declare ownership before an event crosses the scheduler/resolver boundary.
  if (!ACTOR_TYPES.has(event.actorType as SimulationActorType)) {
    throw new Error('Event actorType is invalid. A valid actorType is required.');
  }

  if (event.ownerActorType !== undefined && !ACTOR_TYPES.has(event.ownerActorType as SimulationActorType)) {
    throw new Error('Event ownerActorType is invalid.');
  }

  if (event.summonKind !== undefined && (typeof event.summonKind !== 'string' || !event.summonKind)) {
    throw new Error('Event summonKind must be a non-empty string.');
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
 */
export function createEvent(event: unknown): Readonly<SimulationEvent> {
  const normalized = Object.fromEntries(
    Object.entries({
      schemaVersion: EVENT_SCHEMA_VERSION,
      ...assertSimulationEvent(event),
      at: canonicalTime((event as SimulationEvent).at)
    }).filter(([, value]) => value !== undefined)
  );
  return Object.freeze(normalized as unknown as SimulationEvent);
}

/** Defines emitted events and recipient metadata shared by scheduling, resolution, and presentation. */

export type SimulationActorType = 'player' | 'summon' | 'effect' | 'environment' | 'unknown';

export type EffectRecipientScope = 'self' | 'party' | 'summons';

/** Selects the canonical recipient group for one positive effect. */
export interface EffectAudience {
  readonly recipients: EffectRecipientScope;
  readonly affectsSelf?: boolean;
  readonly maximumRecipients?: number;
  readonly eligibleCompanionIds?: readonly string[];
}

/** Records the recipients selected after player-first audience resolution. */
export interface ResolvedEffectAudience {
  readonly includesSelf: boolean;
  readonly includesSummons: boolean;
  readonly alliedPlayerCount: number;
  readonly companionIds: readonly string[];
  readonly recipientCount: number;
}

/** Closed vocabulary of subsystem-owned annotations preserved as one nested object. */
export interface EffectMetadata {
  /** Proc activations represented by this one primary effect, independent of stacks and damage ticks. */
  readonly procCount?: number;
  readonly activeSpirits?: number;
  readonly affinityOnHit?: boolean;
  readonly anguishConditionalDamage?: boolean;
  readonly blightEmpowered?: boolean;
  readonly dhuumfireDuration?: number;
  readonly dhuumfireInterval?: number;
  readonly engineerMech?: boolean;
  readonly evtcSkillId?: SkillId;
  readonly hitboxIndex?: number;
  readonly largeHitboxOnly?: boolean;
  readonly legendId?: string;
  readonly necromancerBlight?: number;
  readonly necromancerShroudSkillOne?: boolean;
  readonly packetKind?: string;
  readonly radiantWeapon?: string;
  readonly smallHitboxCap?: number;
  readonly spirit?: string;
  readonly spiritAttackType?: string;
  readonly trigger?: string;
}

/** Derive the shared vocabulary while keeping damage and condition payloads discriminated. */
export type CommonSimulationEventType = Exclude<(typeof COMMON_EVENT_TYPES)[number], 'damage' | 'condition'>;

export type CustomSimulationEventType = `${string}.${string}`;

export interface SimulationEventBase<TType extends string = string> {
  readonly schemaVersion?: 1;
  readonly type: TType;
  readonly at: number;
  readonly source: string;
  readonly sourceId: SkillId;
  /** Explicit actor ownership is required before scheduling or resolving an event. */
  readonly actorType: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
  /** Pets and mech keep their own condition rounding; other summons share the player packet. */
  readonly independentConditionOwner?: boolean;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly skillId?: SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly weaponSet?: number;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly detail?: string;
  readonly triggeredBy?: string;
  /** The action's skill grants an evade window, independently of ordinary dodge actions. */
  readonly evades?: boolean;
  readonly activationId?: string;
  /** Monotone identity assigned when the scheduler emits the event. */
  readonly eventOrder?: number;
  /** Same-timestamp position of an event derived from another scheduled event. */
  readonly causalOrder?: number;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrength?: number;
  readonly cooldownReduction?: number;
  readonly audience?: EffectAudience;
  readonly resolvedAudience?: ResolvedEffectAudience;
  readonly metadata?: EffectMetadata;
  readonly damageCalculation?: Gw2DamageCalculation;
  readonly [field: string]: unknown;
}

export type DamageEvent = SimulationEventBase<'damage'> &
  (
    | {
        readonly coefficient: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatDamage: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatStrikeBase: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatStrikePowerCoeff: number;
      }
  ) & {
    readonly coefficientModifiers?: ReadonlyArray<{
      readonly kind: 'target-health-below';
      readonly threshold: number;
      readonly multiplier: number;
    }>;
    readonly hits?: number;
    readonly canCrit?: boolean;
    readonly forceCrit?: boolean;
    readonly canTriggerCriticalSigils?: boolean;
    readonly canTriggerCriticalTraits?: boolean;
    readonly didCrit?: boolean;
  };

export interface ConditionEvent extends SimulationEventBase<'condition'> {
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
}

/** Named core payloads preserve permissive external inputs while making ordinary effect work discoverable. */
export interface BuffEvent extends SimulationEventBase<'buff'> {
  readonly fixedDuration?: boolean;
  readonly schedulerBoonPrediction?: boolean;
}

export interface BoonExtensionEvent extends SimulationEventBase<'boon_extension'> {
  readonly duration: number;
  readonly extensionAudience?: 'self' | 'all';
  readonly excludedKind?: string;
}

export type WeaponSetEvent = SimulationEventBase<'weapon_set'>;

/** Environment ticks and direct condition packets carry data only; mutable owner wakes belong to condition resolution. */
export interface ConditionTickEvent extends SimulationEventBase<'condition_tick'> {
  readonly condition?: string;
  readonly fraction?: number;
  readonly damage?: number;
}

export type CommonSimulationEvent =
  | BuffEvent
  | BoonExtensionEvent
  | WeaponSetEvent
  | ConditionTickEvent
  | SimulationEventBase<
      Exclude<CommonSimulationEventType, 'buff' | 'boon_extension' | 'weapon_set' | 'condition_tick'>
    >;

export type CustomSimulationEvent = SimulationEventBase<CustomSimulationEventType>;

export type SimulationEvent = DamageEvent | ConditionEvent | CommonSimulationEvent | CustomSimulationEvent;

/** Input constructors share the envelope; runtime validation still owns external acceptance. */
export type SimulationEventInput = SimulationEventBase;
