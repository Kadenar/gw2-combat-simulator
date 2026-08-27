/**
 * Minimal, handler-driven resolver for scheduled event streams. Drains the
 * stream through a registered handler registry and accumulates canonical damage
 * totals, per-source breakdowns, and resolver-side profession state. Shared GW2
 * resolution layers build on this state shape rather than reimplementing queue
 * management.
 */
import { assertScheduledEventStream } from '../events/scheduled-stream.js';
import { createEventQueue, StableEventQueue, takeNextEvent } from '../events/queue.js';
import { cloneProfessionState } from '../profession/state.js';
import { resolveProfessionRuntime } from '../profession/family.js';

import type {
  NormalizedProfessionContract,
  ProfessionSource,
  ScheduledEventStream,
  SchedulerConfig,
  SimulationEvent,
  SkillId
} from '../types.js';

// Minimal resolver implementation for event streams whose behavior is fully
// provided by registered handlers. Shared GW2 resolution layers build on this
// state shape rather than reimplementing queue management.

/**
 * Per-source damage totals accumulated by the direct resolver.
 */
export interface DirectResolverBreakdownEntry {
  id: SkillId;
  name: string;
  damage: number;
  strikeDamage: number;
  conditionDamage: number;
  hits: number;
}

/**
 * The two per-source fields the direct resolver accumulates alongside `damage`.
 */
export type DirectResolverDamageField = 'strikeDamage' | 'conditionDamage';

/**
 * One boon application retained by the direct resolver as history.
 */
export interface DirectResolverBoonApplication {
  at: number;
  expiresAt: number;
  stacks: number;
}

/**
 * Mutable state consumed by direct stream resolution.
 */
export interface DirectResolverState<TProfessionState = unknown> {
  time: number;
  config: SchedulerConfig;
  profession: TProfessionState;
  totals: { strike: number; condition: number };
  breakdown: Map<SkillId, DirectResolverBreakdownEntry>;
  conditions: Map<string, number>;
  boons: Map<string, DirectResolverBoonApplication[]>;
  resolvedEvents: SimulationEvent[];
  procs: SimulationEvent[];
  warnings: string[];
}

/**
 * Context passed to each registered direct-resolver handler. Handlers own the
 * common numeric work before deferring to profession reactions.
 */
export interface DirectResolverContext<TProfessionState = unknown> {
  readonly profession: NormalizedProfessionContract<TProfessionState & object>;
  readonly config: SchedulerConfig;
  readonly state: DirectResolverState<TProfessionState>;
  readonly queue: StableEventQueue<SimulationEvent>;
  readonly stream: ScheduledEventStream;
  addBreakdown(id: SkillId, name: string, type: DirectResolverDamageField, damage: number, hits?: number): void;
}

/**
 * A profession contract able to seed direct-resolver profession state.
 */
export type DirectResolverProfession<TProfessionState extends object = object> = ProfessionSource<TProfessionState>;

interface CreateResolverStateOptions<TProfessionState extends object> {
  readonly profession: DirectResolverProfession<TProfessionState>;
  readonly config?: SchedulerConfig;
  readonly stream?: ScheduledEventStream;
}

/**
 * Creates the base mutable state consumed by stream resolution.
 */
export function createResolverState<TProfessionState extends object>({
  profession,
  config = {} as SchedulerConfig
}: CreateResolverStateOptions<TProfessionState>): DirectResolverState<TProfessionState> {
  const activeProfession = resolveProfessionRuntime(profession, config);
  return {
    time: 0,
    config,
    profession: cloneProfessionState(
      typeof activeProfession.createResolverState === 'function'
        ? activeProfession.createResolverState(config)
        : activeProfession.createProfessionState(config)
    ) as TProfessionState,
    totals: { strike: 0, condition: 0 },
    breakdown: new Map(),
    conditions: new Map(),
    boons: new Map(),
    resolvedEvents: [],
    procs: [],
    warnings: []
  };
}

/**
 * Accumulates per-skill damage totals in the canonical breakdown map.
 */
export function addBreakdown(
  state: DirectResolverState,
  id: SkillId,
  name: string,
  type: DirectResolverDamageField,
  damage: number,
  hits = 0
): void {
  const current = state.breakdown.get(id) || {
    id,
    name,
    damage: 0,
    strikeDamage: 0,
    conditionDamage: 0,
    hits: 0
  };
  current.damage += damage;
  current[type] += damage;
  current.hits += hits;
  state.breakdown.set(id, current);
}

interface ResolveScheduledStreamOptions<TProfessionState extends object> {
  readonly stream: unknown;
  readonly profession: DirectResolverProfession<TProfessionState>;
  readonly handlerRegistry?: {
    require(types: Iterable<string>): unknown;
    dispatch(event: SimulationEvent, context: unknown): unknown;
  } | null;
  readonly config?: SchedulerConfig;
}

export interface ResolveScheduledStreamResult<TProfessionState = unknown> {
  readonly duration: number;
  readonly totalDamage: number;
  readonly dps: number;
  readonly strikeDamage: number;
  readonly conditionDamage: number;
  readonly breakdown: DirectResolverBreakdownEntry[];
  readonly events: readonly SimulationEvent[];
  readonly resolvedEvents: SimulationEvent[];
  readonly profession: TProfessionState;
  readonly warnings: string[];
}

/**
 * Runs a scheduled event stream through the supplied handler registry and
 * returns canonical damage totals plus resolver-side state snapshots.
 */
export function resolveScheduledStream<TProfessionState extends object>({
  stream,
  profession,
  handlerRegistry,
  config = {} as SchedulerConfig
}: ResolveScheduledStreamOptions<TProfessionState>): ResolveScheduledStreamResult<TProfessionState> {
  const scheduled = assertScheduledEventStream(stream);
  const activeProfession = resolveProfessionRuntime(profession, config);
  if (!handlerRegistry) throw new TypeError('Resolver requires a handler registry.');
  handlerRegistry.require(scheduled.events.map((event) => event.type));
  const state = createResolverState({
    profession: activeProfession,
    config,
    stream: scheduled
  });
  const queue = createEventQueue<SimulationEvent>(scheduled.events.map((event) => ({ ...event }) as SimulationEvent));
  const context: DirectResolverContext<TProfessionState> = {
    profession: activeProfession,
    config,
    state,
    queue,
    stream: scheduled,
    addBreakdown: (...args) => addBreakdown(state, ...args)
  };
  while (queue.length > 0) {
    const event = takeNextEvent(queue);
    if (!event) break;
    state.time = event.at;
    handlerRegistry.dispatch(event, context);
    state.resolvedEvents.push(event);
  }

  const duration = Math.max(0.0001, scheduled.rotationEndTime);
  const totalDamage = state.totals.strike + state.totals.condition;
  return {
    duration,
    totalDamage,
    dps: totalDamage / duration,
    strikeDamage: state.totals.strike,
    conditionDamage: state.totals.condition,
    breakdown: [...state.breakdown.values()].sort((left, right) => right.damage - left.damage),
    events: scheduled.events,
    resolvedEvents: state.resolvedEvents,
    profession: state.profession,
    warnings: state.warnings
  };
}
