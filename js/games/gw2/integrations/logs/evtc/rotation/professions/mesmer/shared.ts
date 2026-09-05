import type { ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import {
  canonicalAction,
  catalogDuration as castDuration,
  combatStartTime,
  hasNearbyAction,
  playerInstance,
  rawSkillName
} from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

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
  chaosStorm: '921F3521FB79F240B1A8F7EC855F8DF9',
  chronomancerRewinder: 'DC1C8A043ADCD24B9458688A792B04BA',
  chronomancerSplitSecond: 'C035166E3E4C414ABE640F47797D9B4A',
  chronomancerTimeSink: 'AB2E22E7EE74DA4C87DA777C62E475EA',
  cryOfFrustration: '52F65A4D9970954BA849CB57A46A65A8',
  diversion: '916D8385083F144EBAA5BEEDE21FD47A',
  distortionOrMindWrack: '3D29ABD39CB5BD458C4D50A22FCC0E4B',
  mirageMirror: '1370CDF5F2061445A656A1D77C37A55C',
  mesmerTeleport: 'C34E250B01FF534292EE6AB36D768337',
  signetOfMidnight: '02154B72900B5740A73CD0ADECED27BF',
  virtuosoBladeturnRequiem: '87B761200637AC48B71469F553BA6F60',
  virtuosoThousandCuts: 'E4002B7AD7DF024394D0184B47A316E7'
});

/** Normalizes a skill or action name for case-insensitive comparisons across EVTC and simulator metadata. */
export { normalized };
export { canonicalAction, castDuration, combatStartTime, hasNearbyAction, playerInstance, rawSkillName };

/**
 * Creates a completed canonical cast whose start is derived from its catalog duration and observed end, marking casts
 * that completed before combat as precasts.
 */
export function canonicalCast(
  context: EvtcProfessionReconstructionContext,
  signal: MesmerSignal,
  identity: MesmerActionIdentity,
  end: number,
  evidence: EvtcRecordedRotationAction['evidence'] = 'effect'
): EvtcRecordedRotationAction {
  const duration = castDuration(context, identity);
  const combatStart = combatStartTime(context);
  return canonicalAction(signal.eventIndex, end - duration, identity, signal.event.skillId, evidence, {
    end,
    expectedDuration: duration,
    status: 'completed',
    precast: combatStart != null && end <= combatStart
  });
}

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

/**
 * Resolves encounter-local effect content IDs to GUIDs and returns player-sourced effect-create events matching the
 * requested Mesmer effect GUID.
 */
export function effectSignals(context: EvtcProfessionReconstructionContext, guid: string): MesmerSignal[] {
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

/**
 * Returns positive, non-buff damage packets for the requested skill IDs that were emitted directly by the selected
 * player and are not activation or state-change records.
 */
export function directSkillSignals(
  context: EvtcProfessionReconstructionContext,
  skillIds: ReadonlySet<number>
): MesmerSignal[] {
  return context.log.events.flatMap((event, eventIndex) =>
    event.source === context.playerAddress &&
    skillIds.has(event.skillId) &&
    event.stateChange === EVTC_STATE_CHANGE.NONE &&
    event.activation === EVTC_ACTIVATION.NONE &&
    event.buff === 0 &&
    (event.value > 0 || event.buffDamage > 0)
      ? [{ event, eventIndex }]
      : []
  );
}

/**
 * Returns gains of one buff targeting the selected player, optionally including BuffInitial records used to recover
 * state or precasts that began before the visible combat timeline.
 */
export function buffGainSignals(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  includeInitial = false
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

/**
 * Sorts signals and retains the first signal of each cluster, starting a new cluster after the configured time gap or
 * source-count limit.
 */
export function clusterSignals(
  signals: readonly MesmerSignal[],
  gapMs: number,
  maximumClusterSize = Number.POSITIVE_INFINITY
): MesmerSignal[] {
  const sorted = [...signals].sort(
    (left, right) => left.event.time - right.event.time || left.eventIndex - right.eventIndex
  );
  const clustered: MesmerSignal[] = [];
  let previousTime = Number.NEGATIVE_INFINITY;
  let clusterSize = 0;
  for (const signal of sorted) {
    if (signal.event.time - previousTime > gapMs || clusterSize >= maximumClusterSize) {
      clustered.push(signal);
      clusterSize = 0;
    }

    clusterSize += 1;
    previousTime = signal.event.time;
  }

  return clustered;
}

/**
 * Reports whether a skill is selected in the imported build, or null when the context contains no skill-selection data
 * and the analyzer must use evidence-only heuristics.
 */
export function selectedSkill(
  context: EvtcProfessionReconstructionContext,
  identity: MesmerActionIdentity
): boolean | null {
  const hasSelection = (context.selectedSkillIds?.length || 0) > 0 || (context.selectedSkillNames?.length || 0) > 0;
  if (!hasSelection) return null;
  return (
    context.selectedSkillIds?.includes(identity.skillId) === true ||
    context.selectedSkillNames?.some((name) => normalized(name) === normalized(identity.name)) === true
  );
}

/** Sorts actions and removes later actions with the same canonical/raw skill ID inside the deduplication window. */
export function dedupeActions(
  actions: readonly EvtcRecordedRotationAction[],
  windowMs = 50
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const kept: EvtcRecordedRotationAction[] = [];
  for (const action of sorted) {
    const identity = action.canonicalSkillId ?? action.rawSkillId;
    const duplicate = kept.some(
      (candidate) =>
        (candidate.canonicalSkillId ?? candidate.rawSkillId) === identity &&
        Math.abs(candidate.start - action.start) <= windowMs
    );
    if (!duplicate) kept.push(action);
  }

  return kept;
}
