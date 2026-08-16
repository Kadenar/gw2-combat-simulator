import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../types.js";
import { findRotationSkill } from "../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

/** Thief-only EVTC buff/effect aliases and animation packet normalization. */

const CALTROPS = Object.freeze({ name: "Caltrops", skillId: 13028 });
const SPIDER_VENOM = Object.freeze({ name: "Spider Venom", skillId: 13037 });
const ASSASSINS_SIGNET = Object.freeze({
  name: "Assassin's Signet",
  skillId: 13046,
});
const PREPARE_THOUSAND_NEEDLES = Object.freeze({
  name: "Prepare Thousand Needles",
  skillId: 13026,
});
const THOUSAND_NEEDLES = Object.freeze({
  name: "Thousand Needles",
  skillId: 56898,
});
const CHAK_SHIELD = Object.freeze({ name: "Chak Shield", skillId: 76816 });
const STONE_SUMMIT_CANNON = Object.freeze({
  name: "Stone Summit Cannon",
  skillId: 76725,
});
const SKRITT_SWIPE = Object.freeze({ name: "Skritt Swipe", skillId: 77397 });
const CANACH_COIN_TOSS = Object.freeze({
  name: "Canach-Coin Toss",
  skillId: 77230,
});
const FLAWLESS_EXECUTION = Object.freeze({
  name: "Flawless Execution",
  skillId: 80244,
});
const STEAL = Object.freeze({ name: "Steal", skillId: 13014 });
const DEADEYES_MARK = Object.freeze({
  name: "Deadeye's Mark",
  skillId: 43390,
});
const KNEEL = Object.freeze({ name: "Kneel", skillId: 40600 });
const MERCY = Object.freeze({ name: "Mercy", skillId: 41372 });
const SHADOW_SWAP = Object.freeze({ name: "Shadow Swap", skillId: 45672 });
const SHADOW_FLARE = Object.freeze({ name: "Shadow Flare", skillId: 41158 });
const SHADOW_MELD = Object.freeze({ name: "Shadow Meld", skillId: 45508 });
const WELL_OF_SORROW = Object.freeze({
  name: "Well of Sorrow",
  skillId: 63276,
});

const ASSASSINS_SIGNET_ACTIVE_BUFF = 44597;
const SPIDER_VENOM_BUFF = 13036;
const PREPARED_THOUSAND_NEEDLES_BUFF = 56895;
const CHAK_SHIELD_BUFF = 78288;
const VIGOR_BUFF = 726;
const MIGHT_BUFF = 740;
const DEADEYES_GAZE_BUFF = 46333;
const KNEELING_BUFF = 42869;
const SHADOW_FLARE_RETURN_BUFF = 42774;
const RELIC_OF_THE_DEADEYE_BUFF = 70282;
const MOVEMENT_ARTIFACT_FOLLOW_UP_ANIMATION = 18059;
const METAL_LEGION_GUITAR_FOLLOW_UP_ANIMATION = 76596;
const DAREDEVIL_DODGE_ANIMATION = 23275;
const SPECTER_POST_COMBAT_ANIMATION = 23285;
const TWILIGHT_COMBO_ANIMATION = 63254;
const TWILIGHT_COMBO_FOLLOW_UP_ANIMATION = 63181;
const EFFECT_START_STATE_CHANGE = 57;
const SIGNAL_WINDOW_MS = 150;
const MARK_REFRESH_MERCY_THRESHOLD_MS = 12_000;
const MERCY_SIGNAL_LOOKBACK_MS = 2_500;
const FLAWLESS_CHAIN_WINDOW_MS = 50;
const CANACH_OPENER_OFFSET_MS = 100;
const CANACH_FOLLOW_UP_LEAD_MS = 190;
const CANACH_FOLLOW_UP_DELAY_MS = 14_000;
const CANACH_LATE_RECAST_MIN_MS = 9_000;
const CANACH_LATE_RECAST_MAX_MS = 13_000;
const CANACH_FLAWLESS_THRESHOLD = 30;

interface ThiefActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

function playerEvent(
  context: EvtcProfessionReconstructionContext,
  event: EvtcProfessionReconstructionContext["log"]["events"][number],
): boolean {
  return (
    event.source === context.playerAddress ||
    event.target === context.playerAddress
  );
}

function combatStart(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress &&
        event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT,
    )?.time ?? null
  );
}

function skillDuration(
  context: EvtcProfessionReconstructionContext,
  identity: ThiefActionIdentity,
): number {
  const skill = findRotationSkill(
    identity.skillId,
    identity.name,
    context.catalog,
    context.profile,
  );
  return Math.max(
    0,
    Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
  );
}

function canonicalAction(
  eventIndex: number,
  start: number,
  identity: ThiefActionIdentity,
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

function hasRecordedAction(
  actions: readonly EvtcRecordedRotationAction[],
  identity: ThiefActionIdentity,
  time: number,
  windowMs = SIGNAL_WINDOW_MS,
): boolean {
  const normalizedName = identity.name.toLowerCase();
  return actions.some(
    (action) =>
      (action.rawSkillId === identity.skillId ||
        action.canonicalSkillId === identity.skillId ||
        action.rawName.trim().toLowerCase() === normalizedName ||
        action.canonicalName?.trim().toLowerCase() === normalizedName) &&
      Math.abs(action.start - time) <= windowMs,
  );
}

function uniqueBuffApplyActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  buffSkillId: number,
  identity: ThiefActionIdentity,
): EvtcRecordedRotationAction[] {
  const inferred: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== buffSkillId ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      hasRecordedAction(actions, identity, event.time) ||
      inferred.some(
        (action) => Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    inferred.push(
      canonicalAction(eventIndex, event.time, identity, event.skillId),
    );
  });
  return inferred;
}

function hasSelectedSkill(
  context: EvtcProfessionReconstructionContext,
  identity: ThiefActionIdentity,
): boolean {
  return (
    context.selectedSkillNames == null ||
    context.selectedSkillNames.some(
      (name) => name.trim().toLowerCase() === identity.name.toLowerCase(),
    )
  );
}

function pairedDaredevilDodgeActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "daredevil") return [];
  const starts: Array<{
    readonly time: number;
    readonly eventIndex: number;
  }> = [];
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== DAREDEVIL_DODGE_ANIMATION
    ) {
      return;
    }
    if (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START) {
      starts.push({ time: event.time, eventIndex });
      return;
    }
    if (event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP) return;
    const start = starts.shift();
    if (!start || event.time < start.time) return;
    const duration = event.time - start.time;
    actions.push({
      ...canonicalAction(
        start.eventIndex,
        start.time,
        {
          name: context.profile.dodge.name,
          skillId: Number(context.profile.dodge.skillId),
        },
        event.skillId,
        "animation",
      ),
      end: event.time,
      expectedDuration: duration,
      status: "completed",
    });
  });
  return actions;
}

function daredevilStealActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "daredevil") return [];
  const events = context.log.events;
  return events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== VIGOR_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      hasRecordedAction(actions, STEAL, event.time)
    ) {
      return [];
    }
    const mightPackets = events.filter(
      (candidate) =>
        candidate.source === context.playerAddress &&
        candidate.target === context.playerAddress &&
        candidate.skillId === MIGHT_BUFF &&
        candidate.buff !== 0 &&
        candidate.buffRemove === 0 &&
        candidate.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY &&
        Math.abs(candidate.time - event.time) <= SIGNAL_WINDOW_MS,
    ).length;
    if (mightPackets < 5) {
      return [];
    }
    return [canonicalAction(eventIndex, event.time, STEAL, event.skillId)];
  });
}

function deadeyeMechanicActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "deadeye") return [];
  const atCombat = combatStart(context);
  const inferred: EvtcRecordedRotationAction[] = [];
  const gazeEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === DEADEYES_GAZE_BUFF &&
        event.buff !== 0 &&
        event.buffRemove === 0 &&
        (event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ||
          event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY),
    );
  for (const { event, eventIndex } of gazeEvents) {
    const initial = event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL;
    const start = initial
      ? Math.min(event.time, atCombat ?? event.time) - 2
      : event.time;
    inferred.push({
      ...canonicalAction(
        initial ? -3 : eventIndex,
        start,
        DEADEYES_MARK,
        event.skillId,
        initial ? "initial-state" : "buff-transition",
      ),
      ...(initial ? { precast: true } : {}),
    });

    if (initial) continue;
    const refresh = context.log.events.find(
      (candidate) =>
        candidate.skillId === DEADEYES_GAZE_BUFF &&
        candidate.time === event.time &&
        candidate.buff !== 0 &&
        candidate.buffRemove === 2 &&
        candidate.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE &&
        Math.max(candidate.value, candidate.buffDamage) >=
          MARK_REFRESH_MERCY_THRESHOLD_MS,
    );
    if (!refresh) continue;
    const relic = context.log.events
      .map((candidate, candidateIndex) => ({
        event: candidate,
        eventIndex: candidateIndex,
      }))
      .filter(
        ({ event: candidate }) =>
          candidate.source === context.playerAddress &&
          candidate.skillId === RELIC_OF_THE_DEADEYE_BUFF &&
          candidate.buff !== 0 &&
          candidate.buffRemove === 2 &&
          candidate.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE &&
          candidate.time <= event.time &&
          event.time - candidate.time <= MERCY_SIGNAL_LOOKBACK_MS,
      )
      .at(-1);
    const mercyTime = relic?.event.time ?? event.time - 1;
    if (!hasRecordedAction([...actions, ...inferred], MERCY, mercyTime)) {
      inferred.push(
        canonicalAction(
          relic?.eventIndex ?? eventIndex - 0.1,
          mercyTime,
          MERCY,
          RELIC_OF_THE_DEADEYE_BUFF,
        ),
      );
    }
  }

  if (hasSelectedSkill(context, MERCY)) {
    context.log.events.forEach((event, eventIndex) => {
      if (
        event.source !== context.playerAddress ||
        event.skillId !== RELIC_OF_THE_DEADEYE_BUFF ||
        event.buff === 0 ||
        event.buffRemove !== 2 ||
        event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
        hasRecordedAction([...actions, ...inferred], MERCY, event.time)
      ) {
        return;
      }
      const knownCantrip = [SHADOW_FLARE, SHADOW_MELD].some((identity) =>
        actions.some(
          (action) =>
            (action.rawSkillId === identity.skillId ||
              action.canonicalSkillId === identity.skillId) &&
            (Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS ||
              Math.abs(action.end - event.time) <= SIGNAL_WINDOW_MS),
        ),
      );
      if (!knownCantrip) {
        inferred.push(
          canonicalAction(eventIndex, event.time, MERCY, event.skillId),
        );
      }
    });
  }

  const kneeling = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === KNEELING_BUFF &&
        event.buff !== 0 &&
        event.buffRemove === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
    );
  if (kneeling && !hasRecordedAction(actions, KNEEL, kneeling.event.time)) {
    const start = Math.min(
      kneeling.event.time,
      atCombat ?? kneeling.event.time,
    );
    inferred.push({
      ...canonicalAction(
        -2,
        start - 1,
        KNEEL,
        kneeling.event.skillId,
        "initial-state",
      ),
      precast: true,
    });
  }

  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== SHADOW_FLARE_RETURN_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 3 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
      hasRecordedAction([...actions, ...inferred], SHADOW_SWAP, event.time)
    ) {
      return;
    }
    inferred.push(
      canonicalAction(eventIndex, event.time, SHADOW_SWAP, event.skillId),
    );
  });
  return inferred;
}

function thousandNeedlesActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const inferred: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== PREPARED_THOUSAND_NEEDLES_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 3 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
      hasRecordedAction(actions, THOUSAND_NEEDLES, event.time) ||
      inferred.some(
        (action) => Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    inferred.push(
      canonicalAction(eventIndex, event.time, THOUSAND_NEEDLES, event.skillId),
    );
  });
  return inferred;
}

function initialPrepareThousandNeedlesAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === PREPARED_THOUSAND_NEEDLES_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
    );
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  const skill = findRotationSkill(
    PREPARE_THOUSAND_NEEDLES.skillId,
    PREPARE_THOUSAND_NEEDLES.name,
    context.catalog,
    context.profile,
  );
  const duration = skillDuration(context, PREPARE_THOUSAND_NEEDLES);
  const cooldownMs = Math.max(0, Number(skill?.cooldown || 0) * 1000);
  let eventIndex = initial?.eventIndex;
  let rawSkillId = initial?.event.skillId;
  let anchor = atCombat;
  if (!initial) {
    const firstPrepare = actions
      .filter(
        (action) =>
          action.rawSkillId === PREPARE_THOUSAND_NEEDLES.skillId ||
          action.canonicalSkillId === PREPARE_THOUSAND_NEEDLES.skillId,
      )
      .sort((left, right) => left.start - right.start)[0];
    const truncatedCaltrops = context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.skillId === CALTROPS.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
        event.value > 0 &&
        event.time - event.value < atCombat &&
        event.time >= atCombat,
    );
    if (
      !firstPrepare ||
      !truncatedCaltrops ||
      firstPrepare.start > atCombat + 2_000
    ) {
      return [];
    }
    eventIndex = firstPrepare.eventIndex - 0.2;
    rawSkillId = PREPARED_THOUSAND_NEEDLES_BUFF;
    anchor = firstPrepare.start;
  }
  const start = anchor - cooldownMs - duration;
  return [
    {
      ...canonicalAction(
        eventIndex ?? -1,
        start,
        PREPARE_THOUSAND_NEEDLES,
        rawSkillId ?? PREPARED_THOUSAND_NEEDLES_BUFF,
        "initial-state",
      ),
      end: start + duration,
      expectedDuration: duration,
      status: "completed",
      precast: true,
    },
  ];
}

function unrecordedOpeningThousandNeedlesAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const hasInitialPreparedState = context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === PREPARED_THOUSAND_NEEDLES_BUFF &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
  );
  if (hasInitialPreparedState) return [];
  const atCombat = combatStart(context);
  const firstPrepare = actions
    .filter(
      (action) =>
        action.rawSkillId === PREPARE_THOUSAND_NEEDLES.skillId ||
        action.canonicalSkillId === PREPARE_THOUSAND_NEEDLES.skillId,
    )
    .sort((left, right) => left.start - right.start)[0];
  if (
    atCombat == null ||
    !firstPrepare ||
    firstPrepare.start > atCombat + 2_000
  ) {
    return [];
  }
  const hasTruncatedCaltrops = context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === CALTROPS.skillId &&
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
      event.value > 0 &&
      event.time - event.value < atCombat &&
      event.time >= atCombat,
  );
  if (!hasTruncatedCaltrops) return [];
  return [
    canonicalAction(
      firstPrepare.eventIndex - 0.1,
      firstPrepare.start - 1,
      THOUSAND_NEEDLES,
      PREPARED_THOUSAND_NEEDLES_BUFF,
      "initial-state",
    ),
  ];
}

function initialSkrittSwipeAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === SKRITT_SWIPE.skillId &&
        event.stateChange === EFFECT_START_STATE_CHANGE,
    );
  if (
    !signal ||
    hasRecordedAction(actions, SKRITT_SWIPE, signal.event.time, 500)
  ) {
    return [];
  }
  const atCombat = combatStart(context) ?? signal.event.time;
  const duration = skillDuration(context, SKRITT_SWIPE);
  const end = Math.min(atCombat, signal.event.time);
  return [
    {
      ...canonicalAction(
        signal.eventIndex,
        end - duration,
        SKRITT_SWIPE,
        signal.event.skillId,
        "initial-state",
      ),
      end,
      expectedDuration: duration,
      status: "completed",
      precast: true,
    },
  ];
}

function truncatedCaltropsAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const firstPlayerEventTime = Math.min(
    ...context.log.events
      .filter((event) => event.time > 0 && playerEvent(context, event))
      .map((event) => event.time),
  );
  if (!Number.isFinite(firstPlayerEventTime)) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== CALTROPS.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE &&
        event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0 ||
      event.time - event.value >= firstPlayerEventTime ||
      hasRecordedAction(actions, CALTROPS, event.time, 1000)
    ) {
      return [];
    }
    const start = event.time - event.value;
    return [
      {
        ...canonicalAction(
          eventIndex,
          start,
          CALTROPS,
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

function specterPrecastActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  if (
    context.profile.specializationId !== "specter" ||
    !hasSelectedSkill(context, WELL_OF_SORROW)
  ) {
    return [];
  }
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  const wellSignal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === WELL_OF_SORROW.skillId &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.value > 0 &&
        Math.abs(event.time - atCombat) <= SIGNAL_WINDOW_MS,
    );
  if (
    !wellSignal ||
    hasRecordedAction(actions, WELL_OF_SORROW, atCombat, 1_000)
  ) {
    return [];
  }
  const duration = skillDuration(context, WELL_OF_SORROW);
  const wellStart = atCombat - duration;
  const inferred: EvtcRecordedRotationAction[] = [
    {
      ...canonicalAction(
        wellSignal.eventIndex,
        wellStart,
        WELL_OF_SORROW,
        wellSignal.event.skillId,
        "initial-state",
      ),
      end: atCombat,
      expectedDuration: duration,
      status: "completed",
      precast: true,
    },
  ];
  const initialSpider = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === SPIDER_VENOM_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
    );
  if (
    initialSpider &&
    hasSelectedSkill(context, SPIDER_VENOM) &&
    !hasRecordedAction(actions, SPIDER_VENOM, atCombat, 1_000)
  ) {
    inferred.push({
      ...canonicalAction(
        initialSpider.eventIndex,
        wellStart - 1,
        SPIDER_VENOM,
        initialSpider.event.skillId,
        "initial-state",
      ),
      precast: true,
    });
  }
  return inferred;
}

function specterDelayedWeaponSwapActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "specter") return [];
  const transitions = context.log.events.filter(
    (event) =>
      event.target === context.playerAddress &&
      event.skillId === 63239 &&
      event.buff !== 0 &&
      (event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY ||
        event.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE),
  );
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.WEAPON_SWAP ||
      actions.some(
        (action) =>
          action.rawName === "Swap Weapons" && action.start === event.time,
      )
    ) {
      return [];
    }
    const transitionDistance = Math.min(
      ...transitions.map((transition) =>
        Math.abs(transition.time - event.time),
      ),
    );
    if (transitionDistance <= 50 || transitionDistance > SIGNAL_WINDOW_MS) {
      return [];
    }
    const rawSet = Number(event.target);
    return [
      {
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: 0,
        rawName: "Swap Weapons",
        evidence: "state-change" as const,
        status: "instant" as const,
        eventIndex,
        weaponSet:
          Number.isSafeInteger(rawSet) && rawSet > 0 ? rawSet : null,
      },
    ];
  });
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

function normalizeAnimations(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const normalized: EvtcRecordedRotationAction[] = [];
  for (const action of sorted) {
    if (action.rawSkillId === MOVEMENT_ARTIFACT_FOLLOW_UP_ANIMATION) continue;
    if (
      action.rawSkillId === SPECTER_POST_COMBAT_ANIMATION &&
      action.status === "unknown"
    ) {
      continue;
    }
    if (action.status === "interrupted" && isAutoattack(context, action)) {
      continue;
    }
    if (action.status === "interrupted") {
      const duration = skillDuration(context, {
        name: action.canonicalName ?? action.rawName,
        skillId: Number(action.canonicalSkillId ?? action.rawSkillId),
      });
      normalized.push({
        ...action,
        end: action.start + duration,
        expectedDuration: duration,
        status: "completed",
      });
      continue;
    }
    if (action.rawSkillId === TWILIGHT_COMBO_FOLLOW_UP_ANIMATION) {
      let previousIndex = normalized.length - 1;
      let merged = false;
      while (
        previousIndex >= 0 &&
        action.start - normalized[previousIndex].end <= SIGNAL_WINDOW_MS
      ) {
        const previous = normalized[previousIndex];
        if (
          previous.rawSkillId === TWILIGHT_COMBO_ANIMATION &&
          Math.abs(action.start - previous.end) <= SIGNAL_WINDOW_MS
        ) {
          normalized[previousIndex] = {
            ...previous,
            end: Math.max(previous.end, action.end),
          };
          merged = true;
          break;
        }
        previousIndex -= 1;
      }
      if (merged) continue;
    }
    if (action.rawSkillId === METAL_LEGION_GUITAR_FOLLOW_UP_ANIMATION) {
      let previousIndex = normalized.length - 1;
      while (
        previousIndex >= 0 &&
        normalized[previousIndex].rawSkillId !== 76582
      ) {
        previousIndex -= 1;
      }
      if (previousIndex >= 0) {
        const previous = normalized[previousIndex];
        normalized[previousIndex] = {
          ...previous,
          end: Math.max(previous.end, action.end),
        };
      }
      continue;
    }
    normalized.push(action);
  }
  return normalized;
}

function normalizeStoneSummitCannon(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const cannons = actions.filter(
    (action) => action.rawSkillId === STONE_SUMMIT_CANNON.skillId,
  );
  if (!cannons.length) return [...actions];
  const first = cannons[0];
  const directHitsBeforeNextCast = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === STONE_SUMMIT_CANNON.skillId &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.value > 0 &&
        event.time > first.end &&
        event.time < (cannons[1]?.start ?? Number.POSITIVE_INFINITY),
    );
  const firstThree = directHitsBeforeNextCast.slice(0, 3);
  const unanimatedBackfire = directHitsBeforeNextCast[3];
  const hasSuccessPackets =
    firstThree.length === 3 &&
    Math.max(...firstThree.map(({ event }) => event.value)) <
      unanimatedBackfire?.event.value / 2;
  const normalized = actions.map((action) =>
    action === first
      ? { ...action, doubleEdgeOutcome: "success" as const }
      : action.rawSkillId === STONE_SUMMIT_CANNON.skillId
        ? { ...action, doubleEdgeOutcome: "backfire" as const }
        : action,
  );
  if (!hasSuccessPackets || !unanimatedBackfire) return normalized;
  normalized.push({
    ...canonicalAction(
      unanimatedBackfire.eventIndex,
      first.end,
      STONE_SUMMIT_CANNON,
      unanimatedBackfire.event.skillId,
    ),
    doubleEdgeOutcome: "backfire",
  });
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
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  if (
    context.selectedSkillNames &&
    !context.selectedSkillNames.some(
      (name) =>
        name.trim().toLowerCase() === CANACH_COIN_TOSS.name.toLowerCase(),
    )
  ) {
    return [];
  }
  if (
    actions.some(
      (action) =>
        action.rawSkillId === CANACH_COIN_TOSS.skillId ||
        action.canonicalSkillId === CANACH_COIN_TOSS.skillId ||
        action.rawName === CANACH_COIN_TOSS.name ||
        action.canonicalName === CANACH_COIN_TOSS.name,
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
        action.canonicalName === FLAWLESS_EXECUTION.name,
    )
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    );
  if (flawless.length < CANACH_FLAWLESS_THRESHOLD) return [];

  const inferred: EvtcRecordedRotationAction[] = [];
  const add = (
    time: number,
    eventIndex: number,
    doubleEdgeOutcome: "success" | "backfire",
  ): void => {
    if (
      inferred.some(
        (action) => Math.abs(action.start - time) <= SIGNAL_WINDOW_MS,
      )
    ) {
      return;
    }
    inferred.push({
      ...canonicalAction(
        eventIndex,
        time,
        CANACH_COIN_TOSS,
        CANACH_COIN_TOSS.skillId,
        "resource-inference",
      ),
      doubleEdgeOutcome,
    });
  };

  const opening = flawless[1];
  const openingTime =
    opening.start +
    Math.min(
      CANACH_OPENER_OFFSET_MS,
      Math.max(0, opening.end - opening.start - 1),
    );
  add(openingTime, opening.eventIndex + 0.1, "success");

  const followUp = flawless.find(
    (action) => action.start >= openingTime + CANACH_FOLLOW_UP_DELAY_MS,
  );
  if (followUp) {
    add(
      followUp.start - CANACH_FOLLOW_UP_LEAD_MS,
      followUp.eventIndex - 0.1,
      "backfire",
    );
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
    if (
      burst.length < 4 ||
      burst[0].start <= (followUp?.start ?? openingTime)
    ) {
      continue;
    }
    for (const action of burst.slice(2, 4)) {
      add(action.start, action.eventIndex - 0.1, "backfire");
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
          Math.abs(candidate.end - action.start) <= FLAWLESS_CHAIN_WINDOW_MS,
      ),
  );
  if (lateFlawless) {
    add(lateFlawless.start, lateFlawless.eventIndex - 0.1, "backfire");
  }
  return inferred;
}

export function reconstructThiefProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  let actions = normalizeAnimations(context);
  const additions = [
    ...truncatedCaltropsAction(context, actions),
    ...initialSkrittSwipeAction(context, actions),
    ...initialPrepareThousandNeedlesAction(context, actions),
    ...unrecordedOpeningThousandNeedlesAction(context, actions),
    ...pairedDaredevilDodgeActions(context),
    ...uniqueBuffApplyActions(
      context,
      actions,
      ASSASSINS_SIGNET_ACTIVE_BUFF,
      ASSASSINS_SIGNET,
    ),
    ...uniqueBuffApplyActions(
      context,
      actions,
      SPIDER_VENOM_BUFF,
      SPIDER_VENOM,
    ),
    ...uniqueBuffApplyActions(context, actions, CHAK_SHIELD_BUFF, CHAK_SHIELD),
    ...thousandNeedlesActions(context, actions),
  ];
  actions = [...actions, ...additions];
  actions.push(...daredevilStealActions(context, actions));
  actions.push(...deadeyeMechanicActions(context, actions));
  actions.push(...specterDelayedWeaponSwapActions(context, actions));
  actions.push(...specterPrecastActions(context, actions));
  if (context.profile.specializationId !== "antiquary") return actions;
  actions = normalizeStoneSummitCannon(context, actions);
  return [...actions, ...canachCoinTossActions(context, actions)];
}
