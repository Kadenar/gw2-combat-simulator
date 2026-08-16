import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../types.js";
import { findRotationSkill } from "../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

/** Guardian-only EVTC transform, flip, and effect-signal interpretation. */

interface GuardianActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

const SWAP_WEAPONS = Object.freeze({ name: "Swap Weapons", skillId: -3 });
const SWORD_OF_JUSTICE = Object.freeze({
  name: "Sword of Justice",
  skillId: 9168,
});
const ZEALOTS_FLAME = Object.freeze({
  name: "Zealot's Flame",
  skillId: 9104,
});
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
const RUSHING_JUSTICE = Object.freeze({
  name: "Rushing Justice",
  skillId: 62668,
});
const FLOWING_RESOLVE = Object.freeze({
  name: "Flowing Resolve",
  skillId: 62603,
});
const JURISDICTION = Object.freeze({ name: "Jurisdiction", skillId: 71817 });
const RADIANT_COURAGE = Object.freeze({
  name: "Radiant Courage",
  skillId: 78358,
});

const PHYSICAL_WEAPON_SETS = new Set([4, 5]);
const FIREBRAND_TOME_SET = 2;
const JURISDICTION_FOLLOW_UP_ANIMATION = 71818;
const RUSHING_JUSTICE_START_ANIMATION = 62668;
const RUSHING_JUSTICE_IMPACT_ANIMATION = 62624;
const SWORD_OF_JUSTICE_STRIKE = 46469;
const ZEALOTS_FLAME_BUFF = 9103;
const FLOWING_RESOLVE_ACTIVE_BUFF = 62632;
const LUMINARYS_BLESSING_BUFF = 77333;
const PROTECTION_BUFF = 717;
const RESOLUTION_BUFF = 873;
const AEGIS_BUFF = 743;
const SIGNAL_WINDOW_MS = 150;
const MAX_AUTOATTACK_IMPACT_MS = 1500;

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

const AUTOATTACK_CHAINS = Object.freeze([
  Object.freeze([
    Object.freeze({ name: "Strike", skillId: 9137 }),
    Object.freeze({ name: "Vengeful Strike", skillId: 9138 }),
    Object.freeze({ name: "Wrathful Strike", skillId: 9139 }),
  ]),
  Object.freeze([
    Object.freeze({ name: "Core Cleave", skillId: 45047 }),
    Object.freeze({ name: "Bleeding Edge", skillId: 44602 }),
    Object.freeze({ name: "Searing Slash", skillId: 43826 }),
  ]),
]);

function canonicalAction(
  eventIndex: number,
  start: number,
  identity: GuardianActionIdentity,
  rawSkillId: number,
  evidence: EvtcRecordedRotationAction["evidence"] = "buff-transition",
): EvtcRecordedRotationAction {
  return {
    start,
    end: start,
    expectedDuration: 0,
    rawSkillId,
    rawName: identity.name,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence,
    status: "instant",
    eventIndex,
  };
}

function skillFor(
  context: EvtcProfessionReconstructionContext,
  identity: GuardianActionIdentity,
) {
  return findRotationSkill(
    identity.skillId,
    identity.name,
    context.catalog,
    context.profile,
  );
}

function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: GuardianActionIdentity,
): number {
  const normalizedName = identity.name.toLowerCase();
  const completed = context.recordedActions.filter(
    (action) => action.status === "completed" && action.end > action.start,
  );
  const exactDurations = completed
    .filter((action) => action.rawSkillId === identity.skillId)
    .map((action) => action.end - action.start)
    .sort((left, right) => left - right);
  const durations = completed
    .filter((action) => action.rawName.trim().toLowerCase() === normalizedName)
    .map((action) => action.end - action.start)
    .sort((left, right) => left - right);
  if (exactDurations.length) {
    return exactDurations[Math.floor(exactDurations.length / 2)];
  }
  if (durations.length) return durations[Math.floor(durations.length / 2)];
  const skill = skillFor(context, identity);
  return Math.max(
    0,
    Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
  );
}

function firstPlayerEventTime(
  context: EvtcProfessionReconstructionContext,
): number {
  return Math.min(
    ...context.log.events
      .filter(
        (event) =>
          event.time > 0 &&
          (event.source === context.playerAddress ||
            event.target === context.playerAddress),
      )
      .map((event) => event.time),
  );
}

function encounterEndTime(
  context: EvtcProfessionReconstructionContext,
): number | null {
  const targets = new Set(
    context.log.agents
      .filter((agent) => agent.profession === context.log.header.encounterId)
      .map((agent) => agent.address),
  );
  const times = context.log.events
    .filter(
      (event) =>
        targets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT ||
          event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD),
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}

function inferInitialSwordOfJustice(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === SWORD_OF_JUSTICE_STRIKE &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.value > 0,
    );
  if (!signal) return [];
  const skill = skillFor(context, SWORD_OF_JUSTICE);
  const strikeOffsets = (skill?.effects || []).flatMap((effect) => {
    if (effect.type !== "strike") return [];
    const offsets = [
      Number(effect.atMs),
      ...(effect.ticks || []).map((tick) => Number(tick.atMs)),
    ].filter(Number.isFinite);
    return offsets.length ? [Math.min(...offsets)] : [];
  });
  if (!strikeOffsets.length) return [];
  const start = signal.event.time - Math.min(...strikeOffsets);
  const firstEvent = firstPlayerEventTime(context);
  if (!Number.isFinite(firstEvent) || start >= firstEvent) return [];
  if (
    context.recordedActions.some(
      (action) =>
        (action.rawSkillId === SWORD_OF_JUSTICE.skillId ||
          action.rawName === SWORD_OF_JUSTICE.name) &&
        action.start <= signal.event.time &&
        signal.event.time - action.start <= MAX_AUTOATTACK_IMPACT_MS,
    )
  ) {
    return [];
  }
  const duration = recordedDuration(context, SWORD_OF_JUSTICE);
  return [
    {
      ...canonicalAction(
        signal.eventIndex,
        start,
        SWORD_OF_JUSTICE,
        signal.event.skillId,
        "initial-state",
      ),
      end: start + duration,
      expectedDuration: duration,
      status: "completed",
      precast: true,
    },
  ];
}

function inferInitialFlowingResolve(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === FLOWING_RESOLVE_ACTIVE_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buffDamage > event.value,
    );
  if (!initial) return [];
  const duration = recordedDuration(context, FLOWING_RESOLVE);
  const start =
    initial.event.time -
    (initial.event.buffDamage - initial.event.value) -
    duration;
  return [
    {
      ...canonicalAction(
        initial.eventIndex,
        start,
        FLOWING_RESOLVE,
        initial.event.skillId,
        "initial-state",
      ),
      end: start + duration,
      expectedDuration: duration,
      status: "completed",
      precast: true,
    },
  ];
}

function inferInitialJurisdiction(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const skill = skillFor(context, JURISDICTION);
  const strikeOffsets = (skill?.effects || []).flatMap((effect) => {
    if (effect.type !== "strike") return [];
    return [
      Number(effect.atMs),
      ...(effect.ticks || []).map((tick) => Number(tick.atMs)),
    ].filter(Number.isFinite);
  });
  if (!strikeOffsets.length) return [];
  const firstOffset = Math.min(...strikeOffsets);
  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === JURISDICTION_FOLLOW_UP_ANIMATION &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.value > 0,
    );
  if (!signal) return [];
  const start = signal.event.time - firstOffset;
  const firstEvent = firstPlayerEventTime(context);
  if (!Number.isFinite(firstEvent) || start >= firstEvent) return [];
  const duration = recordedDuration(context, JURISDICTION);
  return [
    {
      ...canonicalAction(
        signal.eventIndex,
        start,
        JURISDICTION,
        signal.event.skillId,
        "initial-state",
      ),
      end: start + duration,
      expectedDuration: duration,
      status: "completed",
      precast: true,
    },
  ];
}

function inferTruncatedRushingJustice(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const firstEvent = firstPlayerEventTime(context);
  if (!Number.isFinite(firstEvent)) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== RUSHING_JUSTICE_IMPACT_ANIMATION ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE &&
        event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0 ||
      event.time - event.value >= firstEvent ||
      context.recordedActions.some(
        (action) =>
          action.rawSkillId === RUSHING_JUSTICE_IMPACT_ANIMATION &&
          Math.abs(action.end - event.time) <= SIGNAL_WINDOW_MS,
      )
    ) {
      return [];
    }
    return [
      {
        ...canonicalAction(
          eventIndex,
          event.time - event.value,
          RUSHING_JUSTICE,
          event.skillId,
          "animation",
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: "completed" as const,
        precast: true,
      },
    ];
  });
}

function coalesceCompositeAnimations(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const normalized: EvtcRecordedRotationAction[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    if (action.rawSkillId === JURISDICTION_FOLLOW_UP_ANIMATION) continue;
    if (action.rawSkillId !== RUSHING_JUSTICE_START_ANIMATION) {
      normalized.push(action);
      continue;
    }
    const followUp = sorted[index + 1];
    if (
      followUp?.rawSkillId !== RUSHING_JUSTICE_IMPACT_ANIMATION ||
      followUp.start - action.end > SIGNAL_WINDOW_MS
    ) {
      normalized.push(action);
      continue;
    }
    normalized.push({
      ...action,
      end: Math.max(action.end, followUp.end),
      expectedDuration:
        action.expectedDuration == null && followUp.expectedDuration == null
          ? null
          : Math.max(
              Number(action.expectedDuration || 0),
              Number(followUp.expectedDuration || 0),
            ),
      canonicalSkillId: RUSHING_JUSTICE.skillId,
      canonicalName: RUSHING_JUSTICE.name,
      status: followUp.status,
    });
    index += 1;
  }
  return normalized;
}

function removeDuplicateZeroDurationInterrupts(
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return actions.filter(
    (action) =>
      !(
        action.status === "interrupted" &&
        action.end === action.start &&
        actions.some(
          (candidate) =>
            candidate !== action &&
            candidate.status === "completed" &&
            candidate.rawSkillId === action.rawSkillId &&
            candidate.start >= action.start &&
            candidate.start - action.start <= SIGNAL_WINDOW_MS,
        )
      ),
  );
}

function recoverCompletedZeroDurationCasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (action.status !== "interrupted" || action.end !== action.start) {
      return action;
    }
    const nextSameSkill = actions
      .filter(
        (candidate) =>
          candidate.rawSkillId === action.rawSkillId &&
          candidate.start > action.start,
      )
      .sort((left, right) => left.start - right.start)[0];
    const committed = context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.skillId === action.rawSkillId &&
        event.time >= action.start &&
        event.time < (nextSameSkill?.start ?? action.start + 6_000) &&
        event.time - action.start <= 6_000 &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.value > 0,
    );
    if (!committed) return action;
    const duration = recordedDuration(context, {
      name: action.rawName,
      skillId: action.rawSkillId,
    });
    return {
      ...action,
      end: action.start + duration,
      expectedDuration: duration,
      status: "completed",
    };
  });
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

function normalizeWeaponTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const specialization = context.profile.specializationId;
  const swaps = actions
    .filter((action) => action.rawName === SWAP_WEAPONS.name)
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    );
  const firebrandTomes = new Map<
    number,
    {
      readonly identity: GuardianActionIdentity;
      readonly exitEventIndex: number;
    }
  >();
  if (specialization === "firebrand") {
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
      firebrandTomes.set(entry.eventIndex, {
        identity,
        exitEventIndex: exit.eventIndex,
      });
    }
  }
  const firebrandExits = new Map(
    [...firebrandTomes.values()].map(({ identity, exitEventIndex }) => [
      exitEventIndex,
      identity,
    ]),
  );

  return actions.flatMap((action) => {
    if (action.rawName !== SWAP_WEAPONS.name) return [action];
    const event = context.log.events[action.eventIndex];
    if (!event) return [];
    const currentSet = Number(event.target);
    const previousSet = Number(event.value);
    const physicalSwap =
      PHYSICAL_WEAPON_SETS.has(currentSet) &&
      PHYSICAL_WEAPON_SETS.has(previousSet);
    if (specialization === "luminary") return physicalSwap ? [action] : [];
    if (specialization !== "firebrand") return [action];
    if (physicalSwap) return [action];
    const tome = firebrandTomes.get(action.eventIndex);
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
    if (firebrandExits.has(action.eventIndex)) {
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

function inferZealotsFlame(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const inferred: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== ZEALOTS_FLAME_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE &&
        event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY) ||
      actions.some(
        (action) =>
          (action.rawSkillId === ZEALOTS_FLAME.skillId ||
            action.canonicalSkillId === ZEALOTS_FLAME.skillId) &&
          Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    inferred.push(
      canonicalAction(eventIndex, event.time, ZEALOTS_FLAME, event.skillId),
    );
  });
  return inferred;
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

function inferInitialRadiantCourage(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === LUMINARYS_BLESSING_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buffDamage > event.value,
    );
  if (!initial) return [];
  const start =
    initial.event.time - (initial.event.buffDamage - initial.event.value);
  return [
    {
      ...canonicalAction(
        initial.eventIndex,
        start,
        RADIANT_COURAGE,
        initial.event.skillId,
        "initial-state",
      ),
      precast: true,
    },
  ];
}

function alignInitialRadiantForge(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const initial = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === 77142 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      event.buffDamage > event.value,
  );
  if (!initial) return [...actions];
  const start = initial.time - (initial.buffDamage - initial.value);
  return actions.map((action) =>
    action.initialState === true &&
    action.canonicalSkillId === 77073 &&
    action.start !== start
      ? { ...action, start, end: start }
      : action,
  );
}

function isAutoattack(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  const skill = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile,
  );
  return String(skill?.slot || "").toLowerCase() === "weapon_1";
}

function resetsAutoattackChain(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  if (action.rawName === SWAP_WEAPONS.name) return true;
  const skill = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile,
  );
  const canonicalSkillId = Number(action.canonicalSkillId ?? action.rawSkillId);
  return (
    Number(skill?.castTimeMs || 0) > 0 ||
    skill?.handlerId === "guardian.radiant-forge" ||
    skill?.handlerId === "guardian.stow-tome" ||
    canonicalSkillId === TOME_OF_JUSTICE.skillId ||
    canonicalSkillId === TOME_OF_RESOLVE.skillId ||
    canonicalSkillId === TOME_OF_COURAGE.skillId
  );
}

function normalizeAutoattackChains(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const positions = new Map<
    number,
    { readonly chainIndex: number; readonly actionIndex: number }
  >();
  AUTOATTACK_CHAINS.forEach((chain, chainIndex) => {
    chain.forEach((identity, actionIndex) => {
      positions.set(identity.skillId, { chainIndex, actionIndex });
    });
  });
  let activeChainIndex: number | null = null;
  let expectedActionIndex = 0;
  return [...actions]
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    )
    .map((action) => {
      const position = positions.get(action.rawSkillId);
      if (!position) {
        if (resetsAutoattackChain(context, action)) {
          activeChainIndex = null;
          expectedActionIndex = 0;
        }
        return action;
      }
      const actionIndex =
        activeChainIndex === position.chainIndex ? expectedActionIndex : 0;
      const chain = AUTOATTACK_CHAINS[position.chainIndex];
      const identity = chain[actionIndex];
      if (action.status === "completed" && actionIndex < chain.length - 1) {
        activeChainIndex = position.chainIndex;
        expectedActionIndex = actionIndex + 1;
      } else {
        activeChainIndex = null;
        expectedActionIndex = 0;
      }
      return {
        ...action,
        canonicalSkillId: identity.skillId,
        canonicalName: identity.name,
      };
    });
}

function removeUncommittedAutoattacks(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const autoattacks = actions.filter((action) => isAutoattack(context, action));
  const committed = new Set<EvtcRecordedRotationAction>();
  for (const event of context.log.events) {
    if (
      event.source !== context.playerAddress ||
      event.buff !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.value <= 0
    ) {
      continue;
    }
    const candidate = autoattacks
      .filter(
        (action) =>
          (event.skillId === action.rawSkillId ||
            event.skillId === action.canonicalSkillId) &&
          action.start <= event.time &&
          event.time - action.start <= MAX_AUTOATTACK_IMPACT_MS,
      )
      .sort(
        (left, right) =>
          right.start - left.start || right.eventIndex - left.eventIndex,
      )[0];
    if (candidate) committed.add(candidate);
  }
  return actions.filter(
    (action) => !isAutoattack(context, action) || committed.has(action),
  );
}

function removePostEncounterActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context);
  return encounterEnd == null
    ? [...actions]
    : actions.filter((action) => action.start < encounterEnd);
}

function alignReplayCastLanes(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (action.status !== "completed") return action;
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile,
    );
    const runtimeDuration = Math.max(
      0,
      Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
    );
    const replayCastEnd = Math.max(action.end, action.start + runtimeDuration);
    return replayCastEnd > action.end ? { ...action, replayCastEnd } : action;
  });
}

export function reconstructGuardianProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  let actions = coalesceCompositeAnimations(context, context.recordedActions);
  actions = removeDuplicateZeroDurationInterrupts(actions);
  actions = recoverCompletedZeroDurationCasts(context, actions);
  actions = normalizeWeaponTransitions(context, actions);
  actions.push(...inferZealotsFlame(context, actions));

  if (context.profile.specializationId === "willbender") {
    actions.push(
      ...inferInitialSwordOfJustice(context),
      ...inferInitialFlowingResolve(context),
      ...inferInitialJurisdiction(context),
      ...inferTruncatedRushingJustice(context),
    );
  } else if (context.profile.specializationId === "firebrand") {
    actions.push(
      ...inferFirebrandDamageInstants(context),
      ...inferFirebrandHealMantras(context),
    );
  } else if (context.profile.specializationId === "luminary") {
    actions = alignInitialRadiantForge(context, actions);
    actions.push(...inferInitialRadiantCourage(context));
  }

  actions = removeUncommittedAutoattacks(context, actions);
  actions = normalizeAutoattackChains(context, actions);
  actions = removePostEncounterActions(context, actions);
  return alignReplayCastLanes(context, actions);
}
