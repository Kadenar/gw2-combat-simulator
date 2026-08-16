import type { ParsedEvtcEvent } from "../../../types.js";
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../../types.js";
import { findRotationSkill } from "../../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";

export interface MesmerActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export interface MesmerSignal {
  readonly event: ParsedEvtcEvent;
  readonly eventIndex: number;
}

const EFFECT_CREATE_STATE_CHANGES = new Set([45, 51, 60, 62, 79]);

export const MESMER_EFFECT_GUIDS = Object.freeze({
  chaosStorm: "921F3521FB79F240B1A8F7EC855F8DF9",
  chronomancerRewinder: "DC1C8A043ADCD24B9458688A792B04BA",
  chronomancerSplitSecond: "C035166E3E4C414ABE640F47797D9B4A",
  chronomancerTimeSink: "AB2E22E7EE74DA4C87DA777C62E475EA",
  cryOfFrustration: "52F65A4D9970954BA849CB57A46A65A8",
  diversion: "916D8385083F144EBAA5BEEDE21FD47A",
  distortionOrMindWrack: "3D29ABD39CB5BD458C4D50A22FCC0E4B",
  mirageMirror: "1370CDF5F2061445A656A1D77C37A55C",
  mesmerTeleport: "C34E250B01FF534292EE6AB36D768337",
  signetOfMidnight: "02154B72900B5740A73CD0ADECED27BF",
  virtuosoBladeturnRequiem: "87B761200637AC48B71469F553BA6F60",
  virtuosoThousandCuts: "E4002B7AD7DF024394D0184B47A316E7",
});

export function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
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

export function castDuration(
  context: EvtcProfessionReconstructionContext,
  identity: MesmerActionIdentity,
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

export function canonicalAction(
  eventIndex: number,
  time: number,
  identity: MesmerActionIdentity,
  rawSkillId = identity.skillId,
  evidence: EvtcRecordedRotationAction["evidence"] = "effect",
  options: Partial<EvtcRecordedRotationAction> = {},
): EvtcRecordedRotationAction {
  return {
    start: time,
    end: time,
    expectedDuration: 0,
    rawSkillId,
    rawName: identity.name,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence,
    status: "instant",
    eventIndex,
    ...options,
  };
}

export function canonicalCast(
  context: EvtcProfessionReconstructionContext,
  signal: MesmerSignal,
  identity: MesmerActionIdentity,
  end: number,
  evidence: EvtcRecordedRotationAction["evidence"] = "effect",
): EvtcRecordedRotationAction {
  const duration = castDuration(context, identity);
  const combatStart = combatStartTime(context);
  return canonicalAction(
    signal.eventIndex,
    end - duration,
    identity,
    signal.event.skillId,
    evidence,
    {
      end,
      expectedDuration: duration,
      status: "completed",
      precast: combatStart != null && end <= combatStart,
    },
  );
}

export function combatStartTime(
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

function littleEndianHex(value: bigint): string {
  let current = value;
  let result = "";
  for (let index = 0; index < 8; index += 1) {
    result += Number(current & 0xffn)
      .toString(16)
      .padStart(2, "0");
    current >>= 8n;
  }
  return result.toUpperCase();
}

export function effectSignals(
  context: EvtcProfessionReconstructionContext,
  guid: string,
): MesmerSignal[] {
  const guidByContentId = new Map(
    context.log.events
      .filter((event) => event.stateChange === 46)
      .map((event) => [
        event.skillId,
        littleEndianHex(event.source) + littleEndianHex(event.target),
      ]),
  );
  const normalizedGuid = guid.toUpperCase();
  return context.log.events.flatMap((event, eventIndex) =>
    event.source === context.playerAddress &&
    event.skillId !== 0 &&
    EFFECT_CREATE_STATE_CHANGES.has(event.stateChange) &&
    guidByContentId.get(event.skillId) === normalizedGuid
      ? [{ event, eventIndex }]
      : [],
  );
}

export function directSkillSignals(
  context: EvtcProfessionReconstructionContext,
  skillIds: ReadonlySet<number>,
): MesmerSignal[] {
  return context.log.events.flatMap((event, eventIndex) =>
    event.source === context.playerAddress &&
    skillIds.has(event.skillId) &&
    event.stateChange === EVTC_STATE_CHANGE.NONE &&
    event.activation === EVTC_ACTIVATION.NONE &&
    event.buff === 0 &&
    (event.value > 0 || event.buffDamage > 0)
      ? [{ event, eventIndex }]
      : [],
  );
}

export function buffGainSignals(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  includeInitial = false,
): MesmerSignal[] {
  return context.log.events.flatMap((event, eventIndex) => {
    const supportedState =
      event.stateChange === EVTC_STATE_CHANGE.NONE ||
      event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY ||
      (includeInitial && event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL);
    return event.target === context.playerAddress &&
      event.skillId === skillId &&
      event.buff !== 0 &&
      event.buffRemove === 0 &&
      supportedState
      ? [{ event, eventIndex }]
      : [];
  });
}

export function clusterSignals(
  signals: readonly MesmerSignal[],
  gapMs: number,
): MesmerSignal[] {
  const sorted = [...signals].sort(
    (left, right) =>
      left.event.time - right.event.time || left.eventIndex - right.eventIndex,
  );
  const clustered: MesmerSignal[] = [];
  let previousTime = Number.NEGATIVE_INFINITY;
  for (const signal of sorted) {
    if (signal.event.time - previousTime > gapMs) clustered.push(signal);
    previousTime = signal.event.time;
  }
  return clustered;
}

export function hasNearbyAction(
  actions: readonly EvtcRecordedRotationAction[],
  identity: MesmerActionIdentity,
  time: number,
  windowMs: number,
): boolean {
  const name = normalized(identity.name);
  return actions.some(
    (action) =>
      (action.rawSkillId === identity.skillId ||
        action.canonicalSkillId === identity.skillId ||
        normalized(action.rawName) === name ||
        normalized(action.canonicalName) === name) &&
      Math.min(Math.abs(action.start - time), Math.abs(action.end - time)) <=
        windowMs,
  );
}

export function selectedSkill(
  context: EvtcProfessionReconstructionContext,
  identity: MesmerActionIdentity,
): boolean | null {
  const hasSelection =
    (context.selectedSkillIds?.length || 0) > 0 ||
    (context.selectedSkillNames?.length || 0) > 0;
  if (!hasSelection) return null;
  return (
    context.selectedSkillIds?.includes(identity.skillId) === true ||
    context.selectedSkillNames?.some(
      (name) => normalized(name) === normalized(identity.name),
    ) === true
  );
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

export function dedupeActions(
  actions: readonly EvtcRecordedRotationAction[],
  windowMs = 50,
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const kept: EvtcRecordedRotationAction[] = [];
  for (const action of sorted) {
    const identity = action.canonicalSkillId ?? action.rawSkillId;
    const duplicate = kept.some(
      (candidate) =>
        (candidate.canonicalSkillId ?? candidate.rawSkillId) === identity &&
        Math.abs(candidate.start - action.start) <= windowMs,
    );
    if (!duplicate) kept.push(action);
  }
  return kept;
}
