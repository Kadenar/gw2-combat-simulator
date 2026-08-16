import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../../types.js";
import {
  committedActionsFromStrikePackets,
  firstStrikePacketOffsetMs,
} from "../../effect-packets.js";
import { findRotationSkill } from "../../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import { SIGNAL_DEDUPLICATION_WINDOW_MS } from "./shared.js";

const REDUCED_CAST_TOLERANCE_MS = 50;

const SPLIT_ANIMATION_PAIRS = new Map<number, number>([
  [27074, 28625],
  [62895, 62713],
]);

function mergeSplitAnimations(
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const merged: EvtcRecordedRotationAction[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    const secondId = SPLIT_ANIMATION_PAIRS.get(action.rawSkillId);
    const second = sorted[index + 1];
    if (
      secondId != null &&
      second?.rawSkillId === secondId &&
      Math.abs(second.start - action.end) <= SIGNAL_DEDUPLICATION_WINDOW_MS
    ) {
      merged.push({
        ...action,
        end: Math.max(action.end, second.end),
        status:
          action.status === "unknown" || second.status === "unknown"
            ? "unknown"
            : "completed",
      });
      index += 1;
      continue;
    }
    merged.push(action);
  }
  return merged;
}

function cancelFireAtActionEnd(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === action.rawSkillId &&
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
      event.activation === EVTC_ACTIVATION.CANCEL_FIRE &&
      Math.abs(event.time - action.end) <= SIGNAL_DEDUPLICATION_WINDOW_MS,
  );
}

export function normalizeRevenantCastPackets(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const normalized: EvtcRecordedRotationAction[] = [];
  const autoattacks = actions.filter((action) => {
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile,
    );
    return String(skill?.slot || "").toLowerCase() === "weapon_1";
  });
  const committed = committedActionsFromStrikePackets(context, autoattacks, {
    maxFallbackImpactMs: 2_000,
  });
  const absorbCanceledAnimation = (
    action: EvtcRecordedRotationAction,
  ): void => {
    let previousIndex = normalized.length - 1;
    while (
      previousIndex >= 0 &&
      normalized[previousIndex].end <= normalized[previousIndex].start
    ) {
      previousIndex -= 1;
    }
    if (previousIndex < 0) return;
    const previous = normalized[previousIndex];
    normalized[previousIndex] = {
      ...previous,
      end: Math.max(previous.end, action.end),
    };
  };

  for (const action of mergeSplitAnimations(actions)) {
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile,
    );
    if (
      action.status === "interrupted" &&
      String(skill?.slot || "").toLowerCase() === "weapon_1" &&
      !committed.has(action)
    ) {
      absorbCanceledAnimation(action);
      continue;
    }
    const duration = Math.max(0, action.end - action.start);
    const expected = Math.max(
      0,
      Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
    );
    const autoattack = String(skill?.slot || "").toLowerCase() === "weapon_1";
    const strikeCommit = firstStrikePacketOffsetMs(skill, undefined, {
      explicitOnly: true,
    });
    if (
      autoattack &&
      !committed.has(action) &&
      strikeCommit != null &&
      duration < strikeCommit &&
      cancelFireAtActionEnd(context, action)
    ) {
      absorbCanceledAnimation(action);
      continue;
    }
    if (
      action.status === "completed" &&
      duration > 0 &&
      expected > 0 &&
      duration + REDUCED_CAST_TOLERANCE_MS < expected &&
      cancelFireAtActionEnd(context, action)
    ) {
      normalized.push({ ...action, status: "reduced" as const });
      continue;
    }
    normalized.push(action);
  }
  return normalized;
}
