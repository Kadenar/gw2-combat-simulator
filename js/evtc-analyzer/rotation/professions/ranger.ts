import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../types.js";
import { findRotationSkill } from "../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

/** Ranger-only EVTC bundle, projectile-range, and pet interpretation. */

const BARRAGE = Object.freeze({ name: "Barrage", skillId: 12469 });
const PATH_OF_SCARS = Object.freeze({
  name: "Path of Scars",
  skillId: 12638,
});
const PATH_OF_SCARS_MAX_RANGE = Object.freeze({
  name: "Path of Scars (Max Range)",
  skillId: -1001,
});
const SUMMON_CYCLONE_BOW = Object.freeze({
  name: "Summon Cyclone Bow",
  skillId: 76787,
});
const DISMISS_CYCLONE_BOW = Object.freeze({
  name: "Dismiss Cyclone Bow",
  skillId: 77213,
});
const SWAP_PETS = Object.freeze({ name: "Swap Pets", skillId: -4 });

const CYCLONE_BOW_WEAPON_SET = 2;
const AGENT_SPAWN_STATE_CHANGE = 6;
const PATH_RETURN_GAP_THRESHOLD_MS = 900;
const PATH_HIT_WINDOW_MS = 3000;
const TRUNCATED_CAST_WINDOW_MS = 150;
const CYCLONE_BOW_SKILL_IDS = new Set([
  76664, // Hawkeye
  76722, // Pelt
  76807, // Quarry's Peril
  77012, // Fleeting Zephyr
  77174, // Supersonic Arrow
  77183, // Keen Shot
  77319, // Bluster
]);
const GALESHOT_FALSE_INTERRUPTION_IDS = new Set([
  76757, // Mistral
  76979, // Perfect Storm
  77319, // Bluster
]);

interface RangerRotationSkillFlags {
  readonly petSkill?: boolean;
  readonly petAutonomousSkill?: boolean;
}

function playerInstance(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress && event.sourceInstance > 0,
    )?.sourceInstance ?? null
  );
}

function rawSkillName(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
): string {
  return (
    context.log.skills.find((skill) => skill.id === skillId)?.name.trim() ||
    `Unknown ${skillId}`
  );
}

function rangerSkill(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  name = rawSkillName(context, skillId),
):
  | (NonNullable<ReturnType<typeof findRotationSkill>> &
      RangerRotationSkillFlags)
  | null {
  return findRotationSkill(skillId, name, context.catalog, context.profile) as
    | (NonNullable<ReturnType<typeof findRotationSkill>> &
        RangerRotationSkillFlags)
    | null;
}

function directAction(
  eventIndex: number,
  start: number,
  rawSkillId: number,
  rawName: string,
  canonical: { readonly name: string; readonly skillId: number },
  evidence: EvtcRecordedRotationAction["evidence"],
  extras: Partial<EvtcRecordedRotationAction> = {},
): EvtcRecordedRotationAction {
  return {
    start,
    end: start,
    expectedDuration: 0,
    rawSkillId,
    rawName,
    canonicalSkillId: canonical.skillId,
    canonicalName: canonical.name,
    evidence,
    status: "instant",
    eventIndex,
    ...extras,
  };
}

function truncatedBarrageActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const firstPlayerEventTime = Math.min(
    ...context.log.events
      .filter(
        (event) =>
          event.time > 0 &&
          (event.source === context.playerAddress ||
            event.target === context.playerAddress),
      )
      .map((event) => event.time),
  );
  if (!Number.isFinite(firstPlayerEventTime)) return [];

  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== BARRAGE.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE &&
        event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }
    const start = event.time - event.value;
    const alreadyRecorded = context.recordedActions.some(
      (action) =>
        action.rawSkillId === event.skillId &&
        Math.abs(action.end - event.time) <= TRUNCATED_CAST_WINDOW_MS,
    );
    if (alreadyRecorded || start >= firstPlayerEventTime) return [];
    return [
      {
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          BARRAGE.name,
          BARRAGE,
          "initial-state",
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: "completed" as const,
        precast: true,
      },
    ];
  });
}

function normalizeFalseInterruptions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (
      action.status !== "interrupted" ||
      action.end !== action.start ||
      !GALESHOT_FALSE_INTERRUPTION_IDS.has(action.rawSkillId)
    ) {
      return action;
    }
    const skill = rangerSkill(context, action.rawSkillId, action.rawName);
    const duration = Math.max(
      0,
      Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
    );
    if (duration <= 0) return action;
    return {
      ...action,
      end: action.start + duration,
      expectedDuration: duration,
      status: "completed",
    };
  });
}

function normalizePathOfScarsRange(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const pathActions = actions
    .filter((action) => action.rawSkillId === PATH_OF_SCARS.skillId)
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    );
  return actions.map((action) => {
    if (action.rawSkillId !== PATH_OF_SCARS.skillId) return action;
    const pathIndex = pathActions.indexOf(action);
    const nextStart =
      pathActions[pathIndex + 1]?.start ?? Number.POSITIVE_INFINITY;
    const hits = context.log.events
      .filter(
        (event) =>
          event.source === context.playerAddress &&
          event.skillId === PATH_OF_SCARS.skillId &&
          event.stateChange === EVTC_STATE_CHANGE.NONE &&
          event.activation === EVTC_ACTIVATION.NONE &&
          event.buff === 0 &&
          event.value > 0 &&
          event.target !== context.playerAddress &&
          event.time >= action.start &&
          event.time <= action.start + PATH_HIT_WINDOW_MS &&
          event.time < nextStart,
      )
      .sort((left, right) => left.time - right.time);
    if (
      hits.length < 2 ||
      hits[1].time - hits[0].time <= PATH_RETURN_GAP_THRESHOLD_MS
    ) {
      return action;
    }
    return {
      ...action,
      canonicalSkillId: PATH_OF_SCARS_MAX_RANGE.skillId,
      canonicalName: PATH_OF_SCARS_MAX_RANGE.name,
    };
  });
}

function cycloneBowActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const mapped = actions.map((action) => {
    if (action.rawName !== "Swap Weapons") return action;
    const rawEvent = context.log.events[action.eventIndex];
    const identity =
      action.weaponSet === CYCLONE_BOW_WEAPON_SET
        ? SUMMON_CYCLONE_BOW
        : Number(rawEvent?.value) === CYCLONE_BOW_WEAPON_SET
          ? DISMISS_CYCLONE_BOW
          : null;
    if (!identity) return action;
    return {
      ...action,
      rawName: identity.name,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name,
    };
  });

  const swaps = actions
    .filter((action) => action.rawName === "Swap Weapons")
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    );
  const firstSwap = swaps[0];
  const startsInCycloneBow =
    firstSwap != null &&
    (Number(context.log.events[firstSwap.eventIndex]?.value) ===
      CYCLONE_BOW_WEAPON_SET ||
      actions.some(
        (action) =>
          CYCLONE_BOW_SKILL_IDS.has(action.rawSkillId) &&
          action.start < firstSwap.start,
      ));
  if (!startsInCycloneBow) return mapped;

  const firstAction = [...mapped].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  )[0];
  if (!firstAction) return mapped;
  return [
    ...mapped,
    directAction(
      firstAction.eventIndex + 0.5,
      firstAction.start,
      0,
      SUMMON_CYCLONE_BOW.name,
      SUMMON_CYCLONE_BOW,
      "initial-state",
      { weaponSet: CYCLONE_BOW_WEAPON_SET, precast: true },
    ),
  ];
}

function ownedPetAddresses(
  context: EvtcProfessionReconstructionContext,
  ownerInstance: number,
): ReadonlySet<bigint> {
  const addresses = new Set<bigint>();
  for (const event of context.log.events) {
    if (
      event.source === context.playerAddress ||
      event.sourceMasterInstance !== ownerInstance
    ) {
      continue;
    }
    const skill = rangerSkill(context, event.skillId);
    if (skill?.petSkill === true) addresses.add(event.source);
  }
  return addresses;
}

function petCommandActions(
  context: EvtcProfessionReconstructionContext,
  ownerInstance: number,
  petAddresses: ReadonlySet<bigint>,
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  const starts = new Set<string>();
  const firstPlayerEventTime = Math.min(
    ...context.log.events
      .filter(
        (event) =>
          event.time > 0 &&
          (event.source === context.playerAddress ||
            event.target === context.playerAddress),
      )
      .map((event) => event.time),
  );

  context.log.events.forEach((event, eventIndex) => {
    if (
      !petAddresses.has(event.source) ||
      event.sourceMasterInstance !== ownerInstance ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE
    ) {
      return;
    }
    const name = rawSkillName(context, event.skillId);
    const skill = rangerSkill(context, event.skillId, name);
    if (skill?.petSkill !== true || skill.petAutonomousSkill === true) return;
    const key = `${event.source}:${event.skillId}`;
    if (event.activation === EVTC_ACTIVATION.START) {
      starts.add(key);
      const stop = context.log.events
        .slice(eventIndex + 1)
        .find(
          (candidate) =>
            candidate.source === event.source &&
            candidate.skillId === event.skillId &&
            candidate.stateChange === EVTC_STATE_CHANGE.NONE &&
            (candidate.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
              candidate.activation === EVTC_ACTIVATION.CANCEL_CANCEL ||
              candidate.activation === EVTC_ACTIVATION.RESET),
        );
      actions.push({
        ...directAction(
          eventIndex,
          event.time,
          event.skillId,
          name,
          { name: skill.name, skillId: Number(skill.id) },
          "animation",
        ),
        end: stop?.time ?? event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status:
          stop?.activation === EVTC_ACTIVATION.CANCEL_CANCEL
            ? "interrupted"
            : "completed",
      });
      return;
    }
    if (
      !starts.has(key) &&
      Number.isFinite(firstPlayerEventTime) &&
      event.value > 0 &&
      (event.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
        event.activation === EVTC_ACTIVATION.RESET)
    ) {
      const start = event.time - event.value;
      if (start >= firstPlayerEventTime) return;
      starts.add(key);
      actions.push({
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          name,
          { name: skill.name, skillId: Number(skill.id) },
          "initial-state",
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: "completed",
        precast: true,
      });
    }
  });
  return actions;
}

function petSwapActions(
  context: EvtcProfessionReconstructionContext,
  petAddresses: ReadonlySet<bigint>,
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      !petAddresses.has(event.source) ||
      event.stateChange !== AGENT_SPAWN_STATE_CHANGE
    ) {
      return [];
    }
    return [
      directAction(
        eventIndex,
        event.time,
        0,
        SWAP_PETS.name,
        SWAP_PETS,
        "state-change",
      ),
    ];
  });
}

function petActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const pets = ownedPetAddresses(context, ownerInstance);
  return [
    ...petCommandActions(context, ownerInstance, pets),
    ...petSwapActions(context, pets),
  ];
}

export function reconstructRangerProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== "galeshot") {
    return context.recordedActions;
  }
  const barrage = truncatedBarrageActions(context);
  let actions = normalizeFalseInterruptions(context, [
    ...context.recordedActions,
    ...barrage,
  ]);
  actions = normalizePathOfScarsRange(context, actions);
  actions = cycloneBowActions(context, actions);
  return [...actions, ...petActions(context)];
}
