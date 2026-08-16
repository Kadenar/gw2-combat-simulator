import { findRotationSkill } from "../../catalog.js";
import { committedActionsFromStrikePackets } from "../../effect-packets.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import { SIGNAL_WINDOW_MS, skillDuration } from "./shared.js";

const MOVEMENT_ARTIFACT_FOLLOW_UP_ANIMATION = 18059;
const METAL_LEGION_GUITAR_FOLLOW_UP_ANIMATION = 76596;
const DAREDEVIL_DODGE_ANIMATION = 23275;
const SPECTER_POST_COMBAT_ANIMATION = 23285;
const TWILIGHT_COMBO_ANIMATION = 63254;
const TWILIGHT_COMBO_FOLLOW_UP_ANIMATION = 63181;
const CRIPPLING_STRIKE = Object.freeze({
  name: "Crippling Strike",
  skillId: 13116,
});

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

export function normalizeThiefAnimations(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const normalized: EvtcRecordedRotationAction[] = [];
  const autoattacks = sorted.filter((action) => isAutoattack(context, action));
  const committed = committedActionsFromStrikePackets(context, autoattacks, {
    maxFallbackImpactMs: 2_000,
  });
  for (const action of sorted) {
    if (action.rawSkillId === MOVEMENT_ARTIFACT_FOLLOW_UP_ANIMATION) continue;
    if (action.rawSkillId === DAREDEVIL_DODGE_ANIMATION) continue;
    if (
      action.rawSkillId === SPECTER_POST_COMBAT_ANIMATION &&
      action.status === "unknown"
    ) {
      continue;
    }
    if (action.status === "interrupted" && isAutoattack(context, action)) {
      if (committed.has(action)) {
        normalized.push(action);
      }
      continue;
    }
    const previous = normalized.at(-1);
    if (
      action.rawSkillId === CRIPPLING_STRIKE.skillId &&
      previous?.rawSkillId === CRIPPLING_STRIKE.skillId &&
      action.start - previous.end <= SIGNAL_WINDOW_MS
    ) {
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
        const previousAction = normalized[previousIndex];
        if (
          previousAction.rawSkillId === TWILIGHT_COMBO_ANIMATION &&
          Math.abs(action.start - previousAction.end) <= SIGNAL_WINDOW_MS
        ) {
          normalized[previousIndex] = {
            ...previousAction,
            end: Math.max(previousAction.end, action.end),
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
        const previousAction = normalized[previousIndex];
        normalized[previousIndex] = {
          ...previousAction,
          end: Math.max(previousAction.end, action.end),
        };
      }
      continue;
    }
    normalized.push(action);
  }
  return normalized;
}
