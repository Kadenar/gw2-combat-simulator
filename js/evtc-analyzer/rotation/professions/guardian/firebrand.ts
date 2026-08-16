import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../../types.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import {
  canonicalAction,
  type GuardianActionIdentity,
  isPhysicalWeaponSwap,
  SWAP_WEAPONS,
} from "./shared.js";

const TOME_OF_JUSTICE = Object.freeze({
  name: "Tome of Justice",
  skillId: 44364,
});
const TOME_OF_RESOLVE = Object.freeze({
  name: "Tome of Resolve",
  skillId: 41780,
});
const TOME_OF_COURAGE = Object.freeze({
  name: "Tome of Courage",
  skillId: 42259,
});
const STOW_TOME = Object.freeze({ name: "Stow Tome", skillId: 41380 });
const RESTORING_REPRIEVE = Object.freeze({
  name: "Restoring Reprieve",
  skillId: 41475,
});
const REJUVENATING_RESPITE = Object.freeze({
  name: "Rejuvenating Respite",
  skillId: 42960,
});
const FLAME_RUSH = Object.freeze({ name: "Flame Rush", skillId: 45082 });
const FLAME_SURGE = Object.freeze({ name: "Flame Surge", skillId: 42924 });

const FIREBRAND_TOME_SET = 2;
const PROTECTION_BUFF = 717;
const RESOLUTION_BUFF = 873;
const AEGIS_BUFF = 743;

const FIREBRAND_TOME_CHAPTERS = new Map<number, GuardianActionIdentity>([
  [41258, TOME_OF_JUSTICE],
  [40635, TOME_OF_JUSTICE],
  [42449, TOME_OF_JUSTICE],
  [40015, TOME_OF_JUSTICE],
  [42898, TOME_OF_JUSTICE],
  [45022, TOME_OF_RESOLVE],
  [40679, TOME_OF_RESOLVE],
  [45128, TOME_OF_RESOLVE],
  [42008, TOME_OF_RESOLVE],
  [42925, TOME_OF_RESOLVE],
  [42986, TOME_OF_COURAGE],
  [41968, TOME_OF_COURAGE],
  [41836, TOME_OF_COURAGE],
  [40988, TOME_OF_COURAGE],
  [44455, TOME_OF_COURAGE],
]);

const FIREBRAND_TOME_ACTION_IDS = new Set<number>([
  TOME_OF_JUSTICE.skillId,
  TOME_OF_RESOLVE.skillId,
  TOME_OF_COURAGE.skillId,
]);

export function isFirebrandTomeActionId(skillId: number): boolean {
  return FIREBRAND_TOME_ACTION_IDS.has(skillId);
}

function tomeIdentityBetween(
  actions: readonly EvtcRecordedRotationAction[],
  start: number,
  end: number,
): GuardianActionIdentity | null {
  for (const action of actions) {
    if (action.start < start || action.start >= end) continue;
    const identity = FIREBRAND_TOME_CHAPTERS.get(action.rawSkillId);
    if (identity) return identity;
  }
  return null;
}

export function normalizeFirebrandWeaponTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const swaps = actions
    .filter((action) => action.rawName === SWAP_WEAPONS.name)
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    );
  const tomes = new Map<
    number,
    {
      readonly identity: GuardianActionIdentity;
      readonly exitEventIndex: number;
    }
  >();
  for (const entry of swaps) {
    const event = context.log.events[entry.eventIndex];
    if (Number(event?.target) !== FIREBRAND_TOME_SET) continue;
    const exit = swaps.find(
      (candidate) =>
        candidate.start >= entry.start &&
        Number(context.log.events[candidate.eventIndex]?.value) ===
          FIREBRAND_TOME_SET,
    );
    if (!exit) continue;
    const identity = tomeIdentityBetween(actions, entry.start, exit.start);
    if (!identity) continue;
    tomes.set(entry.eventIndex, {
      identity,
      exitEventIndex: exit.eventIndex,
    });
  }
  const exits = new Map(
    [...tomes.values()].map(({ identity, exitEventIndex }) => [
      exitEventIndex,
      identity,
    ]),
  );

  return actions.flatMap((action) => {
    if (action.rawName !== SWAP_WEAPONS.name) return [action];
    const event = context.log.events[action.eventIndex];
    if (!event) return [];
    if (isPhysicalWeaponSwap(context, action)) return [action];
    const tome = tomes.get(action.eventIndex);
    if (tome) {
      return [
        {
          ...canonicalAction(
            action.eventIndex,
            action.start,
            tome.identity,
            action.rawSkillId,
          ),
          weaponSet: action.weaponSet,
        },
      ];
    }
    if (exits.has(action.eventIndex)) {
      return [
        {
          ...canonicalAction(
            action.eventIndex,
            action.start,
            STOW_TOME,
            action.rawSkillId,
          ),
          weaponSet: action.weaponSet,
        },
      ];
    }
    return [];
  });
}

function inferFirebrandDamageInstants(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    const identity =
      event.skillId === FLAME_RUSH.skillId
        ? FLAME_RUSH
        : event.skillId === FLAME_SURGE.skillId
          ? FLAME_SURGE
          : null;
    if (
      !identity ||
      event.source !== context.playerAddress ||
      event.buff !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.value <= 0
    ) {
      return [];
    }
    return [canonicalAction(eventIndex, event.time, identity, event.skillId)];
  });
}

function inferFirebrandHealMantras(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const byTimestamp = new Map<
    number,
    Array<{
      readonly event: EvtcProfessionReconstructionContext["log"]["events"][number];
      readonly eventIndex: number;
    }>
  >();
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      ![PROTECTION_BUFF, RESOLUTION_BUFF, AEGIS_BUFF].includes(event.skillId) ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      event.value <= 0
    ) {
      return;
    }
    const nearbyTimestamp = [...byTimestamp.keys()].find(
      (timestamp) => Math.abs(timestamp - event.time) <= 5,
    );
    const timestamp = nearbyTimestamp ?? event.time;
    byTimestamp.set(timestamp, [
      ...(byTimestamp.get(timestamp) || []),
      { event, eventIndex },
    ]);
  });

  const inferred: EvtcRecordedRotationAction[] = [];
  for (const [timestamp, signals] of byTimestamp) {
    const ids = new Set(signals.map(({ event }) => event.skillId));
    if (!ids.has(PROTECTION_BUFF) || !ids.has(RESOLUTION_BUFF)) continue;
    const recipients = new Set(signals.map(({ event }) => event.target));
    if (recipients.size < 2 && context.log.agents.length > 1) continue;
    const identity = ids.has(AEGIS_BUFF)
      ? REJUVENATING_RESPITE
      : RESTORING_REPRIEVE;
    inferred.push(
      canonicalAction(
        signals[0].eventIndex,
        timestamp,
        identity,
        signals[0].event.skillId,
      ),
    );
  }
  return inferred;
}

export function reconstructFirebrandActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return [
    ...actions,
    ...inferFirebrandDamageInstants(context),
    ...inferFirebrandHealMantras(context),
  ];
}
