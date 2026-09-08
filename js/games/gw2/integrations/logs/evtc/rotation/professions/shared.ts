import { EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill, normalizedName } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { quicknessReferenceCastTimeMs } from '#gw2/platform/skills/timing.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export interface EvtcActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

const EFFECT_CREATE_STATE_CHANGES = new Set([45, 51, 60, 62, 79]);

/** Encodes a 64-bit EVTC field as eight uppercase little-endian hexadecimal bytes for effect GUID reconstruction. */
function littleEndianHex(value: bigint): string {
  let current = value;
  let result = '';
  for (let index = 0; index < 8; index += 1) {
    result += Number(current & 0xffn)
      .toString(16)
      .padStart(2, '0');
    current >>= 8n;
  }

  return result.toUpperCase();
}

/** Resolves encounter-local content IDs and returns player-sourced effect creations for the requested GUID. */
export function effectSignals(
  context: EvtcProfessionReconstructionContext,
  guid: string
): { event: ParsedEvtcEvent; eventIndex: number }[] {
  const guidByContentId = new Map(
    context.log.events
      .filter((event) => event.stateChange === 46)
      .map((event) => [event.skillId, littleEndianHex(event.source) + littleEndianHex(event.target)])
  );
  const normalizedGuid = guid.toUpperCase();
  return context.log.events.flatMap((event, eventIndex) =>
    event.source === context.playerAddress &&
    event.skillId !== 0 &&
    EFFECT_CREATE_STATE_CHANGES.has(event.stateChange) &&
    guidByContentId.get(event.skillId) === normalizedGuid
      ? [{ event, eventIndex }]
      : []
  );
}

/** Keeps profession reconstruction on one definition of common EVTC identity and timing operations. */
export function combatStartTime(
  context: EvtcProfessionReconstructionContext,
  includeInitialState = false
): number | null {
  const explicit = context.log.events.find(
    (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  )?.time;
  if (explicit != null || !includeInitialState) return explicit ?? null;
  return (
    context.log.events
      .filter((event) => event.target === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL)
      .sort((left, right) => left.time - right.time)[0]?.time ?? null
  );
}

/** Uses the player's first positive instance ID to match owned agents and lifecycle events. */
export function playerInstance(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find((event) => event.source === context.playerAddress && event.sourceInstance > 0)
      ?.sourceInstance ?? null
  );
}

/** Resolves recorded skill metadata while keeping missing IDs stable for diagnostics. */
export function rawSkillName(context: EvtcProfessionReconstructionContext, skillId: number, trim = true): string {
  const name = context.log.skills.find((skill) => skill.id === skillId)?.name;
  return (trim ? name?.trim() : name) || `Unknown ${skillId}`;
}

/** Uses the active catalog's nonnegative Quickness-adjusted duration for inferred casts. */
export function catalogDuration(context: EvtcProfessionReconstructionContext, identity: EvtcActionIdentity): number {
  const skill = findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
  return quicknessReferenceCastTimeMs(skill);
}

/** Builds the common zero-duration shape used when EVTC evidence proves an instantaneous action. */
export function instantAction(
  eventIndex: number,
  time: number,
  rawSkillId: number,
  rawName: string,
  canonical?: EvtcActionIdentity,
  evidence: EvtcRecordedRotationAction['evidence'] = 'effect',
  extras: Partial<EvtcRecordedRotationAction> = {}
): EvtcRecordedRotationAction {
  return {
    start: time,
    end: time,
    expectedDuration: 0,
    rawSkillId,
    rawName,
    evidence,
    status: 'instant',
    eventIndex,
    ...(canonical ? { canonicalSkillId: canonical.skillId, canonicalName: canonical.name } : {}),
    ...extras
  };
}

/** Builds a zero-duration action whose raw name matches its canonical identity. */
export function canonicalAction(
  eventIndex: number,
  time: number,
  identity: EvtcActionIdentity,
  rawSkillId = identity.skillId,
  evidence: EvtcRecordedRotationAction['evidence'] = 'buff-transition',
  extras: Partial<EvtcRecordedRotationAction> = {}
): EvtcRecordedRotationAction {
  return instantAction(eventIndex, time, rawSkillId, identity.name, identity, evidence, extras);
}

/** Prevents independent evidence channels from reconstructing the same nearby action twice. */
export function hasNearbyAction(
  actions: readonly EvtcRecordedRotationAction[],
  identity: EvtcActionIdentity,
  time: number,
  windowMs = 150
): boolean {
  const name = normalizedName(identity.name);
  return actions.some(
    (action) =>
      (action.rawSkillId === identity.skillId ||
        action.canonicalSkillId === identity.skillId ||
        normalizedName(action.rawName) === name ||
        normalizedName(action.canonicalName) === name) &&
      Math.min(Math.abs(action.start - time), Math.abs(action.end - time)) <= windowMs
  );
}
