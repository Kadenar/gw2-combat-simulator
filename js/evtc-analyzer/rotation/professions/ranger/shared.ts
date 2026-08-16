import type { Skill } from "../../../../platform/engine/types.js";
import { EVTC_STATE_CHANGE } from "../../../types.js";
import { findRotationSkill } from "../../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";

export interface RangerActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export interface RangerRotationSkill extends Skill {
  readonly petSkill?: boolean;
  readonly petAutonomousSkill?: boolean;
  readonly unleashedPetSkill?: boolean;
}

export function playerInstance(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress && event.sourceInstance > 0,
    )?.sourceInstance ?? null
  );
}

export function firstPlayerEventTime(
  context: EvtcProfessionReconstructionContext,
): number | null {
  const times = context.log.events
    .filter(
      (event) =>
        event.time > 0 &&
        (event.source === context.playerAddress ||
          event.target === context.playerAddress),
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}

export function rawSkillName(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
): string {
  return (
    context.log.skills.find((skill) => skill.id === skillId)?.name.trim() ||
    `Unknown ${skillId}`
  );
}

export function rangerSkill(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  name = rawSkillName(context, skillId),
): RangerRotationSkill | null {
  return findRotationSkill(
    skillId,
    name,
    context.catalog,
    context.profile,
  ) as RangerRotationSkill | null;
}

export function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: RangerActionIdentity,
): number {
  const skill = rangerSkill(context, identity.skillId, identity.name);
  return Math.max(
    0,
    Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
  );
}

export function directAction(
  eventIndex: number,
  start: number,
  rawSkillId: number,
  rawName: string,
  canonical: RangerActionIdentity,
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

export function encounterEndTime(
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

export function finalizeRangerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context);
  const completionTolerance =
    context.profile.specializationId === "druid" ? 200 : 0;
  return encounterEnd == null
    ? [...actions]
    : actions.filter(
        (action) => action.start < encounterEnd + completionTolerance,
      );
}
