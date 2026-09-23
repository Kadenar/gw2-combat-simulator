import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import {
  gainNecromancerLifeForceOnHit,
  scheduleNecromancerLifeForceGain
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type {
  NecromancerCastContext,
  NecromancerConfig,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSchedulerContext
} from '#gw2/professions/necromancer/types.js';

interface LifeForceGainRecord {
  readonly at: number;
  readonly amount: number;
}

export interface NecromancerSchedulerFeedback {
  readonly targetBelowHalfAt?: number | null;
  /** Spiteful Fortitude grants at the crossing timestamp; same-time strikes resolved before the crossing do not count. */
  readonly boundaryLifeForceGains?: number;
  readonly conditionCounts?: Readonly<Record<string, number>>;
  /** The resolver observes no strike after the target dies, so later hits cannot grant predicted life force. */
  readonly targetDeathAt?: number;
  /** Set only after predicted hit gains disagreed with resolution; the scheduler then replays these observed gains. */
  readonly lifeForceGains?: readonly LifeForceGainRecord[];
}

// Hit gains each scheduler pass granted itself, keyed by scheduler state so refinement can verify them.
const predictedLifeForceGains = new WeakMap<object, LifeForceGainRecord[]>();

/**
 * Grants a hit's life force in the pass that schedules the hit. The resolver emits the same gains, so refinement can
 * confirm the prediction instead of spending another pass replaying them.
 */
export function predictNecromancerLifeForceGain(
  context: NecromancerSchedulerContext,
  at: number,
  amount: number
): void {
  const feedback = context.config._schedulerFeedback as NecromancerSchedulerFeedback | undefined;
  // A replaying pass already queued the resolver's gains; predicting as well would grant each hit twice.
  if (feedback?.lifeForceGains || (feedback?.targetDeathAt != null && at > feedback.targetDeathAt)) return;
  let predictions = predictedLifeForceGains.get(context.state);
  if (!predictions) {
    predictions = [];
    predictedLifeForceGains.set(context.state, predictions);
  }

  predictions.push({ at, amount });
  gainNecromancerLifeForceOnHit(context, at, amount);
}

/** Compares gain multisets; emission order and resolution order can differ for gains at one timestamp. */
function sameLifeForceGains(left: readonly LifeForceGainRecord[], right: readonly LifeForceGainRecord[]): boolean {
  if (left.length !== right.length) return false;
  const order = (a: LifeForceGainRecord, b: LifeForceGainRecord): number => a.at - b.at || a.amount - b.amount;
  const sortedLeft = [...left].sort(order);
  const sortedRight = [...right].sort(order);
  return sortedLeft.every(
    (gain, index) => gain.at === sortedRight[index].at && gain.amount === sortedRight[index].amount
  );
}

/** Finds the first exact damage boundary where the target falls below half health. */
function targetBelowHalfAt(result: Gw2SimulationResult, config: NecromancerConfig): number | null {
  const targetHealth = Number(config.target?.health || 0);
  const damageByTime = new Map<number, number>();
  const addDamage = (at: number, damage: number): void => {
    const amount = Number(damage);
    if (!(amount > 0)) return;
    damageByTime.set(Number(at), (damageByTime.get(Number(at)) || 0) + amount);
  };

  const resolvedEvents = (result.resolvedEvents as readonly NecromancerResolverEvent[] | undefined) || [];
  for (const event of resolvedEvents) {
    if (event.type === 'damage') {
      addDamage(event.at, Number(event.damage || 0));
    } else if (Array.isArray(event.damageTicks)) {
      for (const tick of event.damageTicks) {
        addDamage(Number(tick.at), Number(tick.damage));
      }
    }
  }

  // Scheduler feedback uses the same combined target-health timeline as the
  // resolver while keeping environment damage out of player result totals.
  for (const condition of result.environmentConditionBreakdown || []) {
    for (const tick of condition.damageTicks) {
      addDamage(Number(tick.at), Number(tick.damage));
    }
  }

  let damage = targetHealthLoss(config, null);
  if (damage > targetHealth * 0.5) return 0;
  for (const [at, amount] of [...damageByTime].sort((left, right) => left[0] - right[0])) {
    damage += amount;
    if (damage > targetHealth * 0.5) return at;
  }

  return null;
}

/**
 * Feeds resolver observations back to the scheduler. The half-health boundary drives Gravedigger and Spiteful Fortitude
 * predictions; converged passes must also reproduce every resolved hit gain. Predicted gains are verified against
 * resolution, and only a disagreement with unchanged inputs falls back to replaying the resolver's gains.
 */
export function refineNecromancerSchedulerConfig(
  config: NecromancerConfig,
  result: Gw2SimulationResult
): NecromancerConfig | null {
  const previous = (config._schedulerFeedback || {}) as NecromancerSchedulerFeedback;
  const hasGravediggerCast = result.events.some(
    (event) => event.type === 'action' && Number(event.skillId) === ID.GRAVEDIGGER
  );
  const conditionCounts: Record<string, number> = {};
  const lifeForceGains: LifeForceGainRecord[] = [];
  const spitefulFortitudeTimes: number[] = [];
  for (const event of result.resolvedEvents || []) {
    if (event.type === 'necromancer.target-condition-count') {
      conditionCounts[String(event.observationKey)] = Number(event.conditionCount);
    } else if (event.type === 'necromancer.life-force-gain') {
      lifeForceGains.push({ at: event.at, amount: Number(event.amount) });
      if (Number(event.sourceId) === TRAIT.SPITEFUL_FORTITUDE) spitefulFortitudeTimes.push(event.at);
    }
  }

  const targetBelowHalf =
    (hasGravediggerCast || spitefulFortitudeTimes.length > 0) && Number(config.target?.health) > 0
      ? targetBelowHalfAt(result, config)
      : null;
  const boundaryLifeForceGains =
    targetBelowHalf == null ? 0 : spitefulFortitudeTimes.filter((at) => at === targetBelowHalf).length;
  const inputsChanged =
    (previous.targetBelowHalfAt ?? null) !== targetBelowHalf ||
    (previous.boundaryLifeForceGains ?? 0) !== boundaryLifeForceGains ||
    JSON.stringify(previous.conditionCounts || {}) !== JSON.stringify(conditionCounts);
  const replaying = previous.lifeForceGains != null;
  // The scheduler clock stops at the observation end, so hits the resolver never observes are never granted either.
  const horizon = Number(result.observationEndTime ?? Number.POSITIVE_INFINITY);
  const applied = replaying
    ? previous.lifeForceGains!
    : (predictedLifeForceGains.get(result.schedulerState) || []).filter((gain) => !(gain.at > horizon));
  if (!inputsChanged && sameLifeForceGains(applied, lifeForceGains)) return null;
  const targetDeathAt = Number.isFinite(result.deathTime) ? Number(result.deathTime) : undefined;
  // Death only matters to predictions, so a moved death time earns another prediction only when gains disagreed.
  const predictAgain = !replaying && (inputsChanged || previous.targetDeathAt !== targetDeathAt);
  return {
    ...config,
    _schedulerFeedback: {
      targetBelowHalfAt: targetBelowHalf ?? undefined,
      boundaryLifeForceGains,
      conditionCounts,
      targetDeathAt,
      // Stable inputs with different gains mean prediction missed a resolver-only rule, so later passes replay the
      // observed gains instead.
      ...(predictAgain ? {} : { lifeForceGains })
    }
  };
}

/** Queues resolver-observed gains for a replaying pass; the resource clock applies each at its hit timestamp. */
export function replayNecromancerLifeForceGains(context: NecromancerSchedulerContext): void {
  const feedback = context.config._schedulerFeedback as NecromancerSchedulerFeedback | undefined;
  for (const gain of feedback?.lifeForceGains || []) scheduleNecromancerLifeForceGain(context, gain.at, gain.amount);
}

/** Observe live conditions only when they can change the caller's capped result. */
export function observeTargetConditionCount(
  context: NecromancerCastContext,
  at: number,
  maximum = Number.POSITIVE_INFINITY
): number {
  const configuredCount = targetConditionCount({ config: context.config, time: at });
  // Permanent target assumptions cannot expire, so runtime applications cannot change an already-capped result.
  if (configuredCount >= maximum) return configuredCount;
  const key = `${context.commandIndex}:${context.skill.id}:${at}`;
  context.emit({
    type: 'necromancer.target-condition-count',
    at,
    source: 'necromancer',
    sourceId: context.skill.id,
    actorType: 'player',
    observationKey: key
  });
  const feedback = context.config._schedulerFeedback as NecromancerSchedulerFeedback | undefined;
  return feedback?.conditionCounts?.[key] ?? configuredCount;
}

/** Capture the canonical live count for the next scheduler pass, including expiry and distinct-name deduplication. */
export function resolveTargetConditionCount(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  context.resolved.push({
    ...event,
    conditionCount: targetConditionCount({
      config: context.config,
      query: context.query,
      runtime: context,
      time: event.at
    })
  });
}
