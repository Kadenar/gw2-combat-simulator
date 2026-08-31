import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { canonicalAction, SIGNAL_WINDOW_MS } from '#gw2/integrations/logs/evtc/rotation/professions/thief/shared.js';

const STONE_SUMMIT_CANNON = Object.freeze({
  name: 'Stone Summit Cannon',
  skillId: 76725
});
const CANACH_COIN_TOSS = Object.freeze({
  name: 'Canach-Coin Toss',
  skillId: 77230
});
const FLAWLESS_EXECUTION = Object.freeze({
  name: 'Flawless Execution',
  skillId: 80244
});

const FLAWLESS_CHAIN_WINDOW_MS = 50;
const CANACH_OPENER_OFFSET_MS = 100;
const CANACH_FOLLOW_UP_LEAD_MS = 190;
const CANACH_FOLLOW_UP_DELAY_MS = 14_000;
const CANACH_LATE_RECAST_MIN_MS = 9_000;
const CANACH_LATE_RECAST_MAX_MS = 13_000;
const CANACH_FLAWLESS_THRESHOLD = 30;
const CANNON_SUCCESS_PACKET_COUNT = 3;
const CANNON_SUCCESS_PACKET_WINDOW_MS = 750;
const CANNON_BACKFIRE_VALUE_RATIO = 2;

interface CannonOutcomeSignal {
  readonly outcome: 'success' | 'backfire';
  readonly time: number;
  readonly eventIndex: number;
}

/** Reads each Cannon outcome from its three-hit success or single high-damage backfire packet signature. */
function cannonOutcomeSignals(context: EvtcProfessionReconstructionContext): CannonOutcomeSignal[] {
  const packets = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === STONE_SUMMIT_CANNON.skillId &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.value > 0
    );
  const signals: Array<CannonOutcomeSignal | null> = [];
  const successValues: number[] = [];
  for (let index = 0; index < packets.length;) {
    const group = packets.slice(index, index + CANNON_SUCCESS_PACKET_COUNT);
    const values = group.map(({ event }) => event.value);
    const success =
      group.length === CANNON_SUCCESS_PACKET_COUNT &&
      group.at(-1)!.event.time - group[0].event.time <= CANNON_SUCCESS_PACKET_WINDOW_MS &&
      Math.max(...values) <= Math.min(...values) * CANNON_BACKFIRE_VALUE_RATIO;
    if (success) {
      signals.push({ outcome: 'success', time: group[0].event.time, eventIndex: group[0].eventIndex });
      successValues.push(...values);
      index += CANNON_SUCCESS_PACKET_COUNT;
    } else {
      signals.push(null);
      index += 1;
    }
  }

  const largestSuccessPacket = successValues.length ? Math.max(...successValues) : Number.POSITIVE_INFINITY;
  let packetIndex = 0;
  return signals.flatMap((signal) => {
    if (signal) {
      packetIndex += CANNON_SUCCESS_PACKET_COUNT;
      return [signal];
    }

    const packet = packets[packetIndex++];
    return packet.event.value > largestSuccessPacket * CANNON_BACKFIRE_VALUE_RATIO
      ? [{ outcome: 'backfire' as const, time: packet.event.time, eventIndex: packet.eventIndex }]
      : [];
  });
}

function normalizeStoneSummitCannon(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const cannons = actions
    .filter((action) => action.rawSkillId === STONE_SUMMIT_CANNON.skillId)
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  if (!cannons.length) return [...actions];
  const outcomes = new Map<EvtcRecordedRotationAction, CannonOutcomeSignal[]>();
  for (const signal of cannonOutcomeSignals(context)) {
    const cannon = cannons.filter((action) => action.end <= signal.time).at(-1);
    if (cannon) outcomes.set(cannon, [...(outcomes.get(cannon) || []), signal]);
  }

  const normalized = actions.map((action) => {
    const outcome = outcomes.get(action)?.[0]?.outcome;
    return outcome ? { ...action, doubleEdgeOutcome: outcome } : action;
  });
  for (const cannon of cannons) {
    for (const signal of outcomes.get(cannon)?.slice(1) || []) {
      normalized.push({
        ...canonicalAction(signal.eventIndex, cannon.end, STONE_SUMMIT_CANNON, STONE_SUMMIT_CANNON.skillId),
        doubleEdgeOutcome: signal.outcome
      });
    }
  }

  return normalized;
}

/**
 * Canach-Coin Toss only changes initiative and produces no EVTC cast, damage,
 * or buff packet. A sustained Flawless Execution benchmark still exposes its
 * uses through otherwise-impossible initiative bursts. Recover the established
 * Antiquary pattern from those burst boundaries without guessing in shorter or
 * non-Flawless rotations.
 */
function canachCoinTossActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  if (
    context.selectedSkillNames &&
    !context.selectedSkillNames.some((name) => name.trim().toLowerCase() === CANACH_COIN_TOSS.name.toLowerCase())
  ) {
    return [];
  }

  if (
    actions.some(
      (action) =>
        action.rawSkillId === CANACH_COIN_TOSS.skillId ||
        action.canonicalSkillId === CANACH_COIN_TOSS.skillId ||
        action.rawName === CANACH_COIN_TOSS.name ||
        action.canonicalName === CANACH_COIN_TOSS.name
    )
  ) {
    return [];
  }

  const flawless = actions
    .filter(
      (action) =>
        action.rawSkillId === FLAWLESS_EXECUTION.skillId ||
        action.canonicalSkillId === FLAWLESS_EXECUTION.skillId ||
        action.rawName === FLAWLESS_EXECUTION.name ||
        action.canonicalName === FLAWLESS_EXECUTION.name
    )
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  if (flawless.length < CANACH_FLAWLESS_THRESHOLD) return [];

  const inferred: EvtcRecordedRotationAction[] = [];
  const add = (time: number, eventIndex: number, doubleEdgeOutcome: 'success' | 'backfire'): void => {
    if (inferred.some((action) => Math.abs(action.start - time) <= SIGNAL_WINDOW_MS)) {
      return;
    }

    inferred.push({
      ...canonicalAction(eventIndex, time, CANACH_COIN_TOSS, CANACH_COIN_TOSS.skillId, 'resource-inference'),
      doubleEdgeOutcome
    });
  };

  const opening = flawless[1];
  const openingTime = opening.start + Math.min(CANACH_OPENER_OFFSET_MS, Math.max(0, opening.end - opening.start - 1));
  add(openingTime, opening.eventIndex + 0.1, 'success');

  const followUp = flawless.find((action) => action.start >= openingTime + CANACH_FOLLOW_UP_DELAY_MS);
  if (followUp) {
    add(followUp.start - CANACH_FOLLOW_UP_LEAD_MS, followUp.eventIndex - 0.1, 'backfire');
  }

  const chains: EvtcRecordedRotationAction[][] = [];
  let chain: EvtcRecordedRotationAction[] = [];
  for (const action of flawless) {
    const previous = chain.at(-1);
    if (previous && action.start - previous.end > FLAWLESS_CHAIN_WINDOW_MS) {
      chains.push(chain);
      chain = [];
    }

    chain.push(action);
  }

  if (chain.length) chains.push(chain);
  for (const burst of chains) {
    if (burst.length < 4 || burst[0].start <= (followUp?.start ?? openingTime)) {
      continue;
    }

    for (const action of burst.slice(2, 4)) {
      add(action.start, action.eventIndex - 0.1, 'backfire');
    }
  }

  const lastInferred = Math.max(...inferred.map((action) => action.start));
  const lateFlawless = flawless.find(
    (action) =>
      action.start - lastInferred >= CANACH_LATE_RECAST_MIN_MS &&
      action.start - lastInferred <= CANACH_LATE_RECAST_MAX_MS &&
      actions.some(
        (candidate) =>
          candidate.rawSkillId === STONE_SUMMIT_CANNON.skillId &&
          Math.abs(candidate.end - action.start) <= FLAWLESS_CHAIN_WINDOW_MS
      )
  );
  if (lateFlawless) {
    add(lateFlawless.start, lateFlawless.eventIndex - 0.1, 'backfire');
  }

  return inferred;
}

export function reconstructAntiquaryActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const normalized = normalizeStoneSummitCannon(context, actions);
  return [...normalized, ...canachCoinTossActions(context, normalized)];
}
