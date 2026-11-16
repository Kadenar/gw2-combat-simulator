/** Infer the shared condition clock from periodic damage, keeping estimates separate from imported settings. */
import { prepareEvtcEvidence } from '#gw2/integrations/logs/evtc/rotation/evidence.js';
import { EVTC_STATE_CHANGE, type ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import { CONDITION_TICK_OFFSET_STEP_MS } from '#gw2/platform/combat/condition-clock.js';

const CONDITION_IDS = new Set([736, 737, 723, 19426, 861]);
const PERIOD_MS = 1000;
const JITTER_TOLERANCE_MS = 20;
const MINIMUM_CYCLES = 5;
const MINIMUM_MATCH_FRACTION = 0.8;

export type ConditionClockObservation =
  | {
      readonly status: 'estimated';
      readonly offsetMs: number;
      readonly phaseMs: number;
      readonly tickCount: number;
      readonly matchedTickCount: number;
      readonly jitterMs: number;
    }
  | {
      readonly status: 'unavailable';
      readonly reason:
        'unsupported-recording' | 'no-target' | 'condition-opening' | 'insufficient-ticks' | 'unstable-ticks';
    };

function phaseDifference(left: number, right: number): number {
  return ((left - right + PERIOD_MS * 1.5) % PERIOD_MS) - PERIOD_MS / 2;
}

/** Require repeated, consistent tick evidence on the player's main foe rather than fitting simulation damage. */
export function analyzeConditionClockObservation(log: ParsedEvtc, playerAddress: bigint): ConditionClockObservation {
  // Current ArcDPS explicitly distinguishes periodic BuffCycle damage from removal and on-hit payouts.
  if (Number(log.header.arcdpsBuild) < 20260501) return { status: 'unavailable', reason: 'unsupported-recording' };

  const owners = prepareEvtcEvidence(log).owners;
  const damage = log.events.filter(
    (event) =>
      (event.source === playerAddress || owners.get(event.source) === playerAddress) &&
      event.target !== 0n &&
      event.iff === 1 &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === 0 &&
      event.buffRemove === 0 &&
      (event.buff === 0 ? event.value : event.buffDamage) > 0
  );
  const damageByTarget = new Map<bigint, number>();
  for (const event of damage) {
    damageByTarget.set(
      event.target,
      (damageByTarget.get(event.target) ?? 0) + (event.buff === 0 ? event.value : event.buffDamage)
    );
  }

  const target = [...damageByTarget].sort(
    ([left, leftDamage], [right, rightDamage]) => rightDamage - leftDamage || (left < right ? -1 : left > right ? 1 : 0)
  )[0]?.[0];

  if (target == null) return { status: 'unavailable', reason: 'no-target' };

  const targetDamage = damage.filter((event) => event.target === target).sort((left, right) => left.time - right.time);
  const firstDamage = targetDamage[0];

  // A condition-only opener does not reveal when accrual began before its first payout.
  if (
    !targetDamage.some(
      (event) => event.time === firstDamage.time && (event.buff === 0 || !CONDITION_IDS.has(event.skillId))
    )
  )
    return { status: 'unavailable', reason: 'condition-opening' };

  // One timestamp is one observation even when several conditions or owned actors tick together.
  const times = [
    ...new Set(
      targetDamage
        .filter((event) => event.buff !== 0 && event.result === 14 && CONDITION_IDS.has(event.skillId))
        .map((event) => event.time - firstDamage.time)
    )
  ];

  if (times.length < MINIMUM_CYCLES) return { status: 'unavailable', reason: 'insufficient-ticks' };

  // Search a circular histogram so jitter across the second boundary remains one phase.
  const histogram = Array<number>(PERIOD_MS).fill(0);
  for (const time of times) histogram[time % PERIOD_MS] += 1;

  let bestPhase = 0;
  let bestCount = 0;
  for (let phase = 0; phase < PERIOD_MS; phase += 1) {
    let count = 0;
    for (let delta = -JITTER_TOLERANCE_MS; delta <= JITTER_TOLERANCE_MS; delta += 1) {
      count += histogram[(phase + delta + PERIOD_MS) % PERIOD_MS];
    }

    if (count > bestCount) {
      bestPhase = phase;
      bestCount = count;
    }
  }

  const differences = times
    .map((time) => phaseDifference(time % PERIOD_MS, bestPhase))
    .filter((delta) => Math.abs(delta) <= JITTER_TOLERANCE_MS)
    .sort((left, right) => left - right);
  const median = differences[Math.floor(differences.length / 2)];
  const phaseMs = (bestPhase + median + PERIOD_MS) % PERIOD_MS;
  const matchedTimes = times.filter(
    (time) => Math.abs(phaseDifference(time % PERIOD_MS, phaseMs)) <= JITTER_TOLERANCE_MS
  );
  const cycles = new Set(matchedTimes.map((time) => Math.round((time - phaseMs) / PERIOD_MS)));

  if (cycles.size < MINIMUM_CYCLES) return { status: 'unavailable', reason: 'insufficient-ticks' };

  if (matchedTimes.length / times.length < MINIMUM_MATCH_FRACTION)
    return { status: 'unavailable', reason: 'unstable-ticks' };

  return {
    status: 'estimated',
    // Round on the circular phase, so an estimate just below one second snaps to zero instead of the largest step.
    offsetMs:
      (Math.round((PERIOD_MS - phaseMs) / CONDITION_TICK_OFFSET_STEP_MS) * CONDITION_TICK_OFFSET_STEP_MS) % PERIOD_MS,
    phaseMs,
    tickCount: times.length,
    matchedTickCount: matchedTimes.length,
    jitterMs: matchedTimes.reduce(
      (maximum, time) => Math.max(maximum, Math.abs(phaseDifference(time % PERIOD_MS, phaseMs))),
      0
    )
  };
}
