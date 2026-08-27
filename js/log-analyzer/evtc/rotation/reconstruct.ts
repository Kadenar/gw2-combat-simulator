import { EvtcError } from '../errors.js';
import { evtcProfessionMetadata, evtcSpecializationMetadata } from '../profession-metadata.js';
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
  type EvtcReconstructedCommand,
  type EvtcRotationAction,
  type EvtcRotationActionStatus,
  type EvtcRotationEvidence,
  type EvtcRotationPlayer,
  type EvtcRotationReconstruction,
  type ParsedEvtc,
  type ParsedEvtcAgent,
  type ParsedEvtcEvent
} from '../types.js';
import {
  actionKind,
  effectWindowMs,
  findNamedRotationSkill,
  findRotationSkill,
  isDirectPlayerSkill,
  skillIdentity,
  type EvtcRotationCatalog
} from './catalog.js';
import {
  EFFECT_PACKET_TOLERANCE_MS,
  missingInterruptCommitWarnings,
  quicknessRuntimeDurationMs,
  reconcileCastEffectPackets
} from './effect-packets.js';
import { EVTC_ROTATION_PROFILES, type EvtcRotationProfessionProfile } from './profiles.js';
import { reconstructProfessionActions, type EvtcRecordedRotationAction } from './professions/index.js';
import { buildReplayTimeline, replayCombatStart } from '../../lib/rotation/timeline.js';
import { observedCommittedInterruptMs } from '../../../platform/gw2/skills/timing.js';

const TIMING_TOLERANCE_MS = 50;
const EVTC_TIMING_QUANTUM_MS = 40;
const TRANSITION_WINDOW_MS = 150;
const STANDARD_DODGE_ANIMATION_ID = 23275;
const STANDARD_DODGE_STOP_ACTIVATION = 6;
const WEAPON_STOW_ANIMATION_ID = 23285;
const TRANSITION_GAIN_BUFF_IDS = new Set(
  EVTC_ROTATION_PROFILES.flatMap((profile) =>
    profile.buffTransitions.flatMap((transition) => (transition.gain ? [transition.buffSkillId] : []))
  )
);
const TRANSITION_LOSS_BUFF_IDS = new Set(
  EVTC_ROTATION_PROFILES.flatMap((profile) =>
    profile.buffTransitions.flatMap((transition) => (transition.loss ? [transition.buffSkillId] : []))
  )
);
const TRANSITION_LOSS_DURATION_BUFF_IDS = new Set(
  EVTC_ROTATION_PROFILES.flatMap((profile) =>
    profile.buffTransitions.flatMap((transition) =>
      transition.lossRequiresRemainingDuration ? [transition.buffSkillId] : []
    )
  )
);

export interface EvtcRotationOptions {
  readonly playerAddress?: bigint | string;
  readonly includeCombatStart?: boolean;
  readonly inferInstantCasts?: boolean;
  readonly selectedSkillNames?: readonly string[];
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}

type RecordedAction = EvtcRecordedRotationAction;

interface ResolvedAction extends RecordedAction {
  readonly skill: ReturnType<typeof findRotationSkill>;
  readonly name: string;
  readonly skillId: string | number;
}

/** Snaps replay-only EVTC timing to the game's 40 ms execution frames. */
function quantizeEvtcTimingMs(value: number): number {
  return Math.max(0, Math.round(value / EVTC_TIMING_QUANTUM_MS) * EVTC_TIMING_QUANTUM_MS);
}

/** Applies the shared observed-cast safety contract to an EVTC action. */
function observedInterruptMs(action: RecordedAction, skill: ReturnType<typeof findRotationSkill>): number | null {
  if (action.forceCompleteReplay === true || (action.replayCastEnd != null && action.replayInterruptMs == null)) {
    return null;
  }

  const observedMs = quantizeEvtcTimingMs(action.replayInterruptMs ?? action.end - action.start);
  const autoattack =
    action.status === 'interrupted' &&
    String(skill?.type || '').toLowerCase() === 'weapon' &&
    String(skill?.slot || '').toLowerCase() === 'weapon_1';
  const runtimeMs = quicknessRuntimeDurationMs(skill);

  // Cancelled autoattacks are real player inputs even before damage commitment;
  // replay their occupied time while the engine suppresses their packets and chain advancement.
  if (autoattack && observedMs > 0 && observedMs < runtimeMs) return observedMs;

  return observedCommittedInterruptMs(skill, action.replayInterruptMs ?? action.end - action.start);
}

/** Expands casts whose uncancellable aftercast keeps the simulator lane occupied through full completion. */
function applyRetainedCastLockouts(
  actions: readonly RecordedAction[],
  catalog: EvtcRotationCatalog | null,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  return actions.map((action) => {
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      catalog,
      profile
    );

    if (skill?.retainsCastLockoutAfterInterrupt !== true) return action;

    // A safe observed interrupt remains explicit; the engine retains the serial
    // cast lane itself while allowing instant actions and weapon swaps through.
    if (observedInterruptMs(action, skill) != null) return action;
    const runtimeDuration = quicknessRuntimeDurationMs(skill);

    if (!(runtimeDuration > 0) || action.end - action.start >= runtimeDuration) return action;
    return {
      ...action,
      end: action.start + runtimeDuration,
      status: 'completed',
      replayCastEnd: action.start + runtimeDuration,
      replayInterruptMs: undefined
    };
  });
}

/** Keeps only safe observed EVTC interrupts and otherwise restores normal simulator cast timing. */
function applyObservedInterruptTiming(
  actions: readonly RecordedAction[],
  catalog: EvtcRotationCatalog | null,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  return actions.map((action) => {
    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      catalog,
      profile
    );
    const interruptMs = observedInterruptMs(action, skill);

    if (interruptMs != null) return { ...action, replayInterruptMs: interruptMs };
    const runtimeDuration = quicknessRuntimeDurationMs(skill);
    const observedDuration = Math.max(0, action.end - action.start);
    const needsDefaultRuntime =
      runtimeDuration > 0 &&
      (action.replayInterruptMs != null ||
        action.status === 'interrupted' ||
        action.status === 'reduced' ||
        observedDuration < runtimeDuration);
    return needsDefaultRuntime
      ? {
          ...action,
          replayCastEnd: Math.max(action.replayCastEnd ?? 0, action.start + runtimeDuration),
          replayInterruptMs: undefined
        }
      : action;
  });
}

function applyEngineReplayTiming(
  actions: readonly RecordedAction[],
  catalog: EvtcRotationCatalog | null,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  return applyRetainedCastLockouts(applyObservedInterruptTiming(actions, catalog, profile), catalog, profile);
}

function addressHex(address: bigint): string {
  return `0x${address.toString(16)}`;
}

function isPlayer(agent: ParsedEvtcAgent): boolean {
  return agent.elite !== 0xffffffff && agent.profession >= 1 && agent.profession <= 9;
}

function selectedPlayerEvent(event: ParsedEvtcEvent, address: bigint): boolean {
  return event.source === address;
}

function rawActionCount(log: ParsedEvtc, address: bigint): number {
  let count = 0;
  let hasModernAnimations = false;
  const lastTransitionSignal = new Map<string, number>();
  for (const event of log.events) {
    if (event.target === address && event.buff !== 0) {
      const gain = event.buffRemove === 0;
      const configured = gain
        ? TRANSITION_GAIN_BUFF_IDS.has(event.skillId)
        : TRANSITION_LOSS_BUFF_IDS.has(event.skillId) &&
          (!TRANSITION_LOSS_DURATION_BUFF_IDS.has(event.skillId) || Math.max(event.value, event.buffDamage) > 0);
      const key = `${event.skillId}:${gain ? 'gain' : 'loss'}`;
      const previous = lastTransitionSignal.get(key);

      if (configured && (previous == null || event.time - previous >= TRANSITION_WINDOW_MS)) {
        count += 1;
        lastTransitionSignal.set(key, event.time);
      }
    }

    if (!selectedPlayerEvent(event, address)) continue;

    if (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START) {
      hasModernAnimations = true;
      count += 1;
    } else if (event.stateChange === EVTC_STATE_CHANGE.WEAPON_SWAP) {
      count += 1;
    }
  }

  if (hasModernAnimations) return count;
  const hasLegacyStarts = log.events.some(
    (event) =>
      selectedPlayerEvent(event, address) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS)
  );
  for (const event of log.events) {
    if (
      selectedPlayerEvent(event, address) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (hasLegacyStarts
        ? event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS
        : event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET)
    ) {
      count += 1;
    }
  }

  return count;
}

function playerDescription(log: ParsedEvtc, agent: ParsedEvtcAgent): EvtcRotationPlayer | null {
  const profession = evtcProfessionMetadata(agent.profession);

  if (!profession) return null;
  const specialization = evtcSpecializationMetadata(agent.elite, profession.id);

  if (!specialization) return null;
  return {
    address: addressHex(agent.address),
    character: agent.character || 'Unnamed player',
    account: agent.account,
    professionId: profession.id,
    professionName: profession.name,
    specializationId: specialization.id,
    specializationName: specialization.name,
    recordedActionCount: rawActionCount(log, agent.address)
  };
}

export function detectEvtcRotationPlayers(log: ParsedEvtc): readonly EvtcRotationPlayer[] {
  return log.agents
    .filter(isPlayer)
    .flatMap((agent) => {
      const player = playerDescription(log, agent);
      return player ? [player] : [];
    })
    .sort(
      (left, right) =>
        right.recordedActionCount - left.recordedActionCount || left.character.localeCompare(right.character)
    );
}

function parseRequestedAddress(address: bigint | string): bigint | null {
  if (typeof address === 'bigint') return address;
  try {
    return BigInt(address);
  } catch {
    return null;
  }
}

function selectPlayerAgent(
  log: ParsedEvtc,
  requestedAddress?: bigint | string
): { readonly agent: ParsedEvtcAgent; readonly player: EvtcRotationPlayer } {
  const players = detectEvtcRotationPlayers(log);

  if (!players.length) {
    throw new EvtcError('NO_PLAYER', 'The EVTC log contains no known player.');
  }

  let selected: EvtcRotationPlayer | undefined;

  if (requestedAddress != null) {
    const parsed = parseRequestedAddress(requestedAddress);
    selected = players.find((player) => parsed != null && BigInt(player.address) === parsed);

    if (!selected) {
      throw new EvtcError('PLAYER_NOT_FOUND', 'The requested player is not present in the EVTC log.');
    }
  } else if (players.length === 1) {
    selected = players[0];
  } else if (players[0].recordedActionCount > players[1].recordedActionCount) {
    selected = players[0];
  } else {
    throw new EvtcError(
      'PLAYER_SELECTION_REQUIRED',
      'Multiple players have the same recorded action count; select one by address.',
      { playerCount: players.length }
    );
  }

  const address = BigInt(selected.address);
  const agent = log.agents.find((candidate) => candidate.address === address);

  if (!agent) {
    throw new EvtcError('PLAYER_NOT_FOUND', 'The selected player agent is missing from the EVTC log.');
  }

  return { agent, player: selected };
}

function skillName(names: ReadonlyMap<number, string>, skillId: number): string {
  // arcdps emits ordinary dodge rolls through an unnamed animation ID; naming it here lets every profession resolve it to its simulator Dodge action.
  if (skillId === STANDARD_DODGE_ANIMATION_ID) return 'Dodge';

  if (skillId === WEAPON_STOW_ANIMATION_ID) return 'Weapon Stow';
  return names.get(skillId)?.trim() || `Unknown ${skillId}`;
}

function expectedDuration(event: ParsedEvtcEvent): number | null {
  const duration = event.buffDamage > 0 ? event.buffDamage : event.value;
  return duration >= 0 ? duration : null;
}

function activationStatus(activation: number): EvtcRotationActionStatus {
  if (activation === EVTC_ACTIVATION.CANCEL_CANCEL) return 'interrupted';

  if (activation === EVTC_ACTIVATION.CANCEL_FIRE) return 'completed';

  if (activation === EVTC_ACTIVATION.RESET) return 'completed';
  return 'unknown';
}

function isStandardDodgeStop(event: ParsedEvtcEvent): boolean {
  return event.skillId === STANDARD_DODGE_ANIMATION_ID && event.activation === STANDARD_DODGE_STOP_ACTIVATION;
}

function isWeaponStowStop(event: ParsedEvtcEvent): boolean {
  return event.skillId === WEAPON_STOW_ANIMATION_ID && event.activation === STANDARD_DODGE_STOP_ACTIVATION;
}

function pairAnimationEvents(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>,
  startStateChange: number,
  endStateChange: number,
  evidence: EvtcRotationEvidence,
  inferTruncatedPrecast = false
): RecordedAction[] {
  const firstPlayerEventTime = Math.min(
    ...log.events.filter((event) => selectedPlayerEvent(event, address) && event.time > 0).map((event) => event.time)
  );
  const combatStartTime = log.events.find(
    (event) => selectedPlayerEvent(event, address) && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  )?.time;
  const starts: Array<{
    readonly event: ParsedEvtcEvent;
    readonly eventIndex: number;
    matched: boolean;
  }> = [];
  const ends: Array<{
    readonly event: ParsedEvtcEvent;
    readonly eventIndex: number;
  }> = [];
  log.events.forEach((event, eventIndex) => {
    if (!selectedPlayerEvent(event, address)) return;

    if (event.stateChange === startStateChange) {
      starts.push({ event, eventIndex, matched: false });
    } else if (
      event.stateChange === endStateChange &&
      (event.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
        event.activation === EVTC_ACTIVATION.CANCEL_CANCEL ||
        event.activation === EVTC_ACTIVATION.RESET ||
        isStandardDodgeStop(event) ||
        isWeaponStowStop(event))
    ) {
      ends.push({ event, eventIndex });
    }
  });

  const actions: RecordedAction[] = [];
  for (const end of ends) {
    const eligible = starts.filter(
      (start) =>
        !start.matched &&
        (start.event.time < end.event.time ||
          (start.event.time === end.event.time && start.eventIndex < end.eventIndex))
    );
    const exact = eligible.filter((start) => start.event.skillId === end.event.skillId);
    const start = (exact.length ? exact : eligible).at(-1);

    if (!start) {
      const rawName = skillName(names, end.event.skillId);
      const inferredStart = end.event.time - end.event.value;
      const truncatedAtLogStart =
        inferTruncatedPrecast && Number.isFinite(firstPlayerEventTime) && inferredStart < firstPlayerEventTime;
      // Modern arcdps can omit an animation start that happened just before combat while still recording its stop.
      const crossesCombatStart =
        combatStartTime != null && inferredStart <= combatStartTime && end.event.time >= combatStartTime;
      const hasCommitEvidence = log.events.some(
        (event) =>
          event.source === address &&
          event.skillId === end.event.skillId &&
          event.time >= inferredStart &&
          event.time <= end.event.time + EFFECT_PACKET_TOLERANCE_MS &&
          event.stateChange === 0 &&
          event.buffRemove === 0 &&
          (event.value > 0 || event.buffDamage > 0)
      );
      const precast = truncatedAtLogStart || (crossesCombatStart && hasCommitEvidence);

      if (end.event.value <= 0 || (!rawName.toLowerCase().includes('dodge') && !precast)) {
        continue;
      }

      actions.push({
        start: inferredStart,
        end: end.event.time,
        expectedDuration: expectedDuration(end.event),
        rawSkillId: end.event.skillId,
        rawName,
        evidence,
        status:
          isStandardDodgeStop(end.event) || isWeaponStowStop(end.event)
            ? 'completed'
            : activationStatus(end.event.activation),
        eventIndex: end.eventIndex,
        precast
      });
      continue;
    }

    start.matched = true;
    const elapsed = Math.max(0, end.event.time - start.event.time);
    const reported = Math.max(0, end.event.value);
    const duration = reported > 0 && Math.abs(reported - elapsed) <= 150 ? reported : elapsed;
    actions.push({
      start: start.event.time,
      end: start.event.time + duration,
      expectedDuration: expectedDuration(start.event),
      rawSkillId: start.event.skillId,
      rawName: skillName(names, start.event.skillId),
      evidence,
      status:
        isStandardDodgeStop(end.event) || isWeaponStowStop(end.event)
          ? 'completed'
          : activationStatus(end.event.activation),
      eventIndex: start.eventIndex
    });
  }

  for (const start of starts) {
    if (start.matched) continue;
    const duration = Math.max(0, expectedDuration(start.event) || 0);
    const rawName = skillName(names, start.event.skillId);

    if (duration === 0 && rawName.startsWith('Unknown ')) continue;
    actions.push({
      start: start.event.time,
      end: start.event.time + duration,
      expectedDuration: duration || null,
      rawSkillId: start.event.skillId,
      rawName,
      evidence,
      status: 'unknown',
      eventIndex: start.eventIndex
    });
  }

  return actions;
}

function modernAnimationActions(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  const startsInConfiguredTransformation = log.events.some(
    (event) =>
      event.target === address &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      profile.buffTransitions.some((transition) => transition.gain != null && transition.buffSkillId === event.skillId)
  );
  return pairAnimationEvents(
    log,
    address,
    names,
    EVTC_STATE_CHANGE.ANIMATION_START,
    EVTC_STATE_CHANGE.ANIMATION_STOP,
    'animation',
    startsInConfiguredTransformation
  );
}

function legacyActivationActions(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>
): RecordedAction[] {
  const starts = log.events.some(
    (event) =>
      selectedPlayerEvent(event, address) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS)
  );

  if (starts) {
    const synthetic: ParsedEvtc = {
      ...log,
      events: log.events.map((event) => {
        if (event.stateChange !== EVTC_STATE_CHANGE.NONE) return event;

        if (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS) {
          return { ...event, stateChange: -1 };
        }

        if (
          event.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
          event.activation === EVTC_ACTIVATION.CANCEL_CANCEL ||
          event.activation === EVTC_ACTIVATION.RESET
        ) {
          return { ...event, stateChange: -2 };
        }

        return event;
      })
    };
    return pairAnimationEvents(synthetic, address, names, -1, -2, 'legacy-activation');
  }

  return log.events.flatMap((event, eventIndex) => {
    if (
      !selectedPlayerEvent(event, address) ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.value <= 0 ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET)
    ) {
      return [];
    }

    return [
      {
        start: event.time,
        end: event.time + event.value,
        expectedDuration: event.value,
        rawSkillId: event.skillId,
        rawName: skillName(names, event.skillId),
        evidence: 'legacy-activation' as const,
        status: activationStatus(event.activation),
        eventIndex
      }
    ];
  });
}

function buffTransitionActions(
  log: ParsedEvtc,
  address: bigint,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  if (!profile.buffTransitions.length) return [];
  const transitionsByBuff = new Map(profile.buffTransitions.map((transition) => [transition.buffSkillId, transition]));
  const lastBySkillId = new Map<string, number>();
  return log.events.flatMap((event, eventIndex) => {
    const buffGain = event.buffRemove === 0;
    const supportedStateChange = buffGain
      ? event.stateChange === EVTC_STATE_CHANGE.NONE ||
        event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY ||
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
      : event.stateChange === EVTC_STATE_CHANGE.NONE ||
        event.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
        event.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_ALL;

    if (event.target !== address || event.buff === 0 || !supportedStateChange) {
      return [];
    }

    const transition = transitionsByBuff.get(event.skillId);

    if (!transition) return [];
    const identity = buffGain ? transition.gain : transition.loss;

    if (!identity) return [];

    if (
      !buffGain &&
      transition.lossRequiresRemainingDuration === true &&
      Math.max(event.value, event.buffDamage) <= 0
    ) {
      return [];
    }

    const key = String(identity.skillId);
    const previous = lastBySkillId.get(key);

    if (previous != null && event.time - previous < TRANSITION_WINDOW_MS) {
      return [];
    }

    lastBySkillId.set(key, event.time);
    return [
      {
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: Number(identity.skillId),
        rawName: identity.name,
        evidence: 'buff-transition' as const,
        status: 'instant' as const,
        eventIndex,
        suppressesWeaponSwap: transition.suppressWeaponSwap,
        initialState: event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
      }
    ];
  });
}

function alignInitialStateTransitions(
  transitions: readonly RecordedAction[],
  casts: readonly RecordedAction[]
): RecordedAction[] {
  const precastStarts = casts.filter((cast) => cast.precast === true).map((cast) => cast.start);

  if (!precastStarts.length) return [...transitions];
  const firstPrecastStart = Math.min(...precastStarts);
  return transitions.map((transition) =>
    transition.initialState === true && transition.start > firstPrecastStart
      ? { ...transition, start: firstPrecastStart, end: firstPrecastStart }
      : transition
  );
}

function initialSummonActions(
  log: ParsedEvtc,
  address: bigint,
  profile: EvtcRotationProfessionProfile,
  catalog: EvtcRotationCatalog | null,
  anchor: number
): RecordedAction[] {
  if (!profile.initialSummons.length || !Number.isFinite(anchor)) return [];
  const playerInstance = log.events.find(
    (event) => selectedPlayerEvent(event, address) && event.sourceInstance > 0
  )?.sourceInstance;

  if (playerInstance == null) return [];
  const initialAgentAddresses = new Set(
    log.events
      .filter(
        (event) =>
          event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
          event.sourceMasterInstance === playerInstance &&
          event.source !== address
      )
      .map((event) => event.source)
  );
  const detected = profile.initialSummons.filter((summon) =>
    log.agents.some((agent) => agent.profession === summon.agentSpeciesId && initialAgentAddresses.has(agent.address))
  );
  let cursor = anchor;
  const reversed: RecordedAction[] = [];
  for (let index = detected.length - 1; index >= 0; index -= 1) {
    const summon = detected[index];
    const skill = findRotationSkill(Number(summon.action.skillId), summon.action.name, catalog, profile);
    const duration = Math.max(0, Number(skill?.castTimeMs || 0));
    cursor -= duration;
    reversed.push({
      start: cursor,
      end: cursor + duration,
      expectedDuration: duration,
      rawSkillId: Number(summon.action.skillId),
      rawName: summon.action.name,
      evidence: 'initial-state',
      status: 'completed',
      eventIndex: -1000 + index,
      precast: true
    });
  }

  return reversed.reverse();
}

function weaponSwapActions(log: ParsedEvtc, address: bigint, transitions: readonly RecordedAction[]): RecordedAction[] {
  return log.events.flatMap((event, eventIndex) => {
    if (!selectedPlayerEvent(event, address) || event.stateChange !== EVTC_STATE_CHANGE.WEAPON_SWAP) {
      return [];
    }

    if (
      transitions.some(
        (transition) =>
          transition.suppressesWeaponSwap === true && Math.abs(transition.start - event.time) <= TRANSITION_WINDOW_MS
      )
    ) {
      return [];
    }

    const rawSet = Number(event.target);
    return [
      {
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: 0,
        rawName: 'Swap Weapons',
        evidence: 'state-change' as const,
        status: 'instant' as const,
        eventIndex,
        weaponSet: Number.isSafeInteger(rawSet) && rawSet > 0 ? rawSet : null
      }
    ];
  });
}

function isEffectSignal(event: ParsedEvtcEvent): boolean {
  if (
    event.activation !== EVTC_ACTIVATION.NONE ||
    (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY)
  ) {
    return false;
  }

  if (event.buff === 0) return event.value > 0 || event.buffDamage > 0;
  return event.buffRemove === 0 && event.value > 0;
}

function inferInstantActions(
  log: ParsedEvtc,
  address: bigint,
  catalog: EvtcRotationCatalog | null,
  profile: EvtcRotationProfessionProfile,
  animated: readonly ResolvedAction[]
): ResolvedAction[] {
  if (!catalog) return [];
  const instantSkills = catalog.skills.filter(
    (skill) =>
      typeof skill.id === 'number' &&
      Number(skill.id) > 0 &&
      !profile.ignoredInstantSkillIds.has(Number(skill.id)) &&
      Number(skill.castTimeMs || 0) === 0 &&
      isDirectPlayerSkill(skill) &&
      actionKind(skill, skill.name) !== 'dodge' &&
      actionKind(skill, skill.name) !== 'weapon-swap'
  );
  const byId = new Map<number, (typeof instantSkills)[number][]>();
  for (const skill of instantSkills) {
    const id = Number(skill.id);
    byId.set(id, [...(byId.get(id) || []), skill]);
  }

  const animatedIds = new Set(animated.map((action) => String(action.skillId)));
  const lastSignal = new Map<string, number>();
  const inferred: ResolvedAction[] = [];
  log.events.forEach((event, eventIndex) => {
    if (!selectedPlayerEvent(event, address) || !isEffectSignal(event)) return;
    const candidates = byId.get(event.skillId);

    if (!candidates?.length) return;
    const resolved = findRotationSkill(event.skillId, candidates[0].name, catalog, profile);

    if (!resolved || animatedIds.has(String(resolved.id))) return;
    const key = String(resolved.id);
    const previous = lastSignal.get(key);

    if (previous != null && event.time - previous < effectWindowMs(resolved)) {
      return;
    }

    lastSignal.set(key, event.time);
    inferred.push({
      start: event.time,
      end: event.time,
      expectedDuration: 0,
      rawSkillId: event.skillId,
      rawName: resolved.name,
      skill: resolved,
      name: resolved.name,
      skillId: resolved.id,
      evidence: 'effect',
      status: 'instant',
      eventIndex
    });
  });
  return inferred;
}

function isDodgeName(name: string): boolean {
  const value = name.trim().toLowerCase();
  return value === 'dodge' || value === 'dodge roll' || value === 'mirage cloak';
}

function resolveAction(
  action: RecordedAction,
  catalog: EvtcRotationCatalog | null,
  profile: EvtcRotationProfessionProfile
): ResolvedAction {
  if (action.rawName === 'Swap Weapons') {
    const skill = findNamedRotationSkill(profile.weaponSwap.name, catalog, profile);
    return {
      ...action,
      skill,
      ...skillIdentity(skill, profile.weaponSwap)
    };
  }

  if (isDodgeName(action.rawName)) {
    const skill = findNamedRotationSkill(profile.dodge.name, catalog, profile);
    return {
      ...action,
      skill,
      ...skillIdentity(skill, profile.dodge)
    };
  }

  const skill = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    catalog,
    profile
  );
  return {
    ...action,
    skill,
    name: skill?.name || action.canonicalName || action.rawName,
    skillId: skill?.id ?? action.canonicalSkillId ?? action.rawSkillId
  };
}

function actionCommand(action: ResolvedAction): EvtcReconstructedCommand {
  const command: {
    name: string;
    skillId?: string | number;
    offset?: number;
    interruptMs?: number;
    doubleEdgeOutcome?: 'success' | 'backfire';
  } = {
    name: action.name,
    skillId: action.skillId
  };
  const interruptMs = observedInterruptMs(action, action.skill);

  // EVTC duration is replayed only after the shared commit check; otherwise
  // omitting interruptMs makes the simulator use its normal Quickness cast.
  if (interruptMs != null) command.interruptMs = interruptMs;

  if (action.doubleEdgeOutcome != null) {
    command.doubleEdgeOutcome = action.doubleEdgeOutcome;
  }

  return command;
}

/** Uses normalized replay timing while preserving EVTC boundaries needed to position overlapping actions. */
function replayActionEnd(action: ResolvedAction): number {
  if (action.replayCastEnd != null) return action.replayCastEnd;

  if (action.replayInterruptMs != null) return action.start + action.replayInterruptMs;

  if (action.status !== 'completed') return action.end;
  const runtimeDuration = quicknessRuntimeDurationMs(action.skill);
  return runtimeDuration > 0 ? Math.max(action.end, action.start + runtimeDuration) : action.end;
}

function buildRotation(
  actions: readonly ResolvedAction[],
  origin: number,
  combatStart: number | null
): EvtcReconstructedCommand[] {
  return buildReplayTimeline(actions, origin, combatStart, {
    timingToleranceMs: TIMING_TOLERANCE_MS,
    quantizeMs: quantizeEvtcTimingMs,
    replayEnd: replayActionEnd,
    commandFor: actionCommand,
    canEmit: (action) => action.skill != null || action.rawName === 'Swap Weapons' || isDodgeName(action.rawName),
    // Continuum Split must stay anchored at its recorded cast boundary so its cooldown snapshot uses the EVTC order.
    isBoundaryTransition: (action, activeCastEnd, previousCastStart) =>
      replayActionEnd(action) <= action.start &&
      action.evidence === 'buff-transition' &&
      action.name === 'Continuum Split' &&
      previousCastStart != null &&
      action.start >= previousCastStart &&
      action.start <= activeCastEnd + TIMING_TOLERANCE_MS
  });
}

function warningList(actions: readonly EvtcRotationAction[], resolved: readonly ResolvedAction[]): string[] {
  const inferred = actions.filter((action) => action.evidence === 'effect');
  const unsupported = actions.filter((action) => !action.supportedByCatalog);
  const unfinished = actions.filter((action) => action.status === 'unknown');
  const interrupted = resolved.filter(
    (action) =>
      action.status === 'interrupted' &&
      action.skill?.interruptCommitMs == null &&
      observedInterruptMs(action, action.skill) == null
  );
  const warnings: string[] = [];

  if (inferred.length) {
    warnings.push(
      `${inferred.length} instant cast${inferred.length === 1 ? ' was' : 's were'} inferred from direct skill effects.`
    );
  }

  if (unsupported.length) {
    warnings.push(
      `${unsupported.length} recorded action${unsupported.length === 1 ? ' is' : 's are'} not present in the supplied simulator catalog.`
    );
  }

  if (unfinished.length) {
    warnings.push(
      `${unfinished.length} animation${unfinished.length === 1 ? ' has' : 's have'} no matching stop event.`
    );
  }

  if (interrupted.length) {
    warnings.push(
      `${interrupted.length} interrupted cast${interrupted.length === 1 ? '' : 's'} lack interruptCommitMs metadata; reconstruction uses the simulator's default Quickness cast ${interrupted.length === 1 ? 'time' : 'times'}.`
    );
  }

  return warnings;
}

function rightAlignInferredAmmoFlips(actions: readonly ResolvedAction[]): ResolvedAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  return actions.map((action) => {
    if (
      action.evidence !== 'effect' ||
      action.end !== action.start ||
      Number(action.skill?.ammo || 0) < 2 ||
      action.skill?.flipParentId == null
    ) {
      return action;
    }

    const containingCast = sorted
      .filter(
        (candidate) =>
          candidate !== action &&
          candidate.start < action.start &&
          (candidate.replayCastEnd ?? candidate.end) > action.start
      )
      .sort((left, right) => right.start - left.start)[0];

    if (!containingCast) return action;
    const containingEnd = containingCast.replayCastEnd ?? containingCast.end;
    const nextSerialAction = sorted.find(
      (candidate) =>
        candidate.start > containingEnd &&
        candidate.skill?.independentCast !== true &&
        candidate.skill?.canCastConcurrently !== true
    );
    const idleAfterCast = Math.max(0, Number(nextSerialAction?.start ?? containingEnd) - containingEnd);
    const shift = Math.min(idleAfterCast, containingEnd - action.start);
    return shift > TIMING_TOLERANCE_MS ? { ...action, start: action.start + shift, end: action.end + shift } : action;
  });
}

export function reconstructWithProfile(
  log: ParsedEvtc,
  profile: EvtcRotationProfessionProfile,
  catalog: EvtcRotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): EvtcRotationReconstruction {
  const { agent, player } = selectPlayerAgent(log, options.playerAddress);

  if (player.professionId !== profile.professionId || player.specializationId !== profile.specializationId) {
    throw new EvtcError(
      'UNSUPPORTED_PROFESSION',
      `The ${profile.professionName} ${profile.specializationName} parser cannot parse ${player.professionName} ${player.specializationName}.`
    );
  }

  const names = new Map(log.skills.map((skill) => [skill.id, skill.name]));
  const hasModernAnimations = log.events.some(
    (event) => selectedPlayerEvent(event, agent.address) && event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START
  );
  const castActions = hasModernAnimations
    ? modernAnimationActions(log, agent.address, names, profile)
    : legacyActivationActions(log, agent.address, names);
  const transitionActions = alignInitialStateTransitions(
    buffTransitionActions(log, agent.address, profile),
    castActions
  ).filter(
    (transition) =>
      !castActions.some(
        (action) =>
          action.rawSkillId === transition.rawSkillId &&
          Math.abs(action.start - transition.start) <= TRANSITION_WINDOW_MS
      )
  );
  const combatStartEvent = log.events.find(
    (event) => selectedPlayerEvent(event, agent.address) && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  );
  const initialStateTime = profile.inferCombatStartFromFirstCast
    ? log.events
        .filter((event) => event.target === agent.address && event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL)
        .sort((left, right) => left.time - right.time)[0]?.time
    : null;
  const inferredCombatStart = profile.inferCombatStartFromFirstCast
    ? (initialStateTime ??
      castActions
        .filter((action) => action.status === 'completed')
        .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)[0]?.start)
    : null;
  let combatStart =
    options.includeCombatStart === false ? null : (combatStartEvent?.time ?? inferredCombatStart ?? null);
  const genericActions = [
    ...castActions,
    ...transitionActions,
    ...weaponSwapActions(log, agent.address, transitionActions)
  ].filter(
    (action) =>
      !(
        (action.rawSkillId === WEAPON_STOW_ANIMATION_ID || action.rawName.trim().toLowerCase() === 'weapon stow') &&
        (action.end <= action.start || findRotationSkill(action.rawSkillId, action.rawName, catalog, profile) == null)
      )
  );
  const replayNormalizedActions = applyEngineReplayTiming(genericActions, catalog, profile);
  const professionContext = {
    log,
    playerAddress: agent.address,
    profile,
    catalog,
    recordedActions: replayNormalizedActions,
    selectedSkillNames: options.selectedSkillNames,
    selectedSkillIds: options.selectedSkillIds,
    professionConfig: options.professionConfig,
    timelineOriginMs: Math.min(
      ...replayNormalizedActions.map((action) => action.start),
      combatStart == null ? Number.POSITIVE_INFINITY : combatStart
    )
  };
  const reconstructedProfessionActions = reconstructProfessionActions(professionContext);
  const professionActions = applyEngineReplayTiming(
    reconcileCastEffectPackets(professionContext, reconstructedProfessionActions),
    catalog,
    profile
  );
  // Keep the EVTC diagnostic separate from replay reconciliation so report-based imports never emit it.
  const interruptCommitWarnings = missingInterruptCommitWarnings(professionContext, professionActions);

  if (options.includeCombatStart !== false && combatStart == null) {
    // A profession parser may recover a clipped opener's combat boundary from its first observed effect packet.
    combatStart =
      professionActions
        .map((action) => action.inferredCombatStart)
        .filter((time): time is number => time != null && Number.isFinite(time))
        .sort((left, right) => left - right)[0] ?? null;
  }

  if (options.includeCombatStart !== false) {
    combatStart = replayCombatStart(professionActions, combatStart);
  }

  const initialSummons = initialSummonActions(
    log,
    agent.address,
    profile,
    catalog,
    Math.min(
      ...professionActions.map((action) => action.start),
      combatStart == null ? Number.POSITIVE_INFINITY : combatStart
    )
  );
  const replayActions = [...professionActions];
  // A clipped precast and BUFF_INITIAL can describe the same already-active summon; keep the initial-state action once.
  for (const initialSummon of initialSummons) {
    const duplicateIndex = replayActions.findIndex(
      (action) =>
        action.precast === true &&
        Number(action.canonicalSkillId ?? action.rawSkillId) === Number(initialSummon.rawSkillId)
    );

    if (duplicateIndex >= 0) replayActions.splice(duplicateIndex, 1);
  }

  const recorded = [...initialSummons, ...replayActions];
  let resolved = recorded.map((action) => resolveAction(action, catalog, profile));

  if (options.inferInstantCasts !== false) {
    resolved.push(...inferInstantActions(log, agent.address, catalog, profile, resolved));
  }

  resolved = rightAlignInferredAmmoFlips(resolved);
  resolved.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);

  if (!resolved.length) {
    throw new EvtcError('NO_ROTATION_ACTIONS', 'The selected player has no reconstructable EVTC actions.');
  }

  const origin = Math.min(resolved[0].start, combatStart == null ? Number.POSITIVE_INFINITY : combatStart);
  const actions: EvtcRotationAction[] = resolved.map((action) => ({
    timestampMs: action.start - origin,
    endTimestampMs: action.end - origin,
    durationMs: action.end - action.start,
    expectedDurationMs: action.expectedDuration,
    rawSkillId: action.rawSkillId,
    skillId: action.skillId,
    name: action.name,
    kind: actionKind(action.skill, action.name),
    evidence: action.evidence,
    status: action.status,
    ...(action.weaponSet === undefined ? {} : { weaponSet: action.weaponSet }),
    ...(action.doubleEdgeOutcome == null ? {} : { doubleEdgeOutcome: action.doubleEdgeOutcome }),
    supportedByCatalog: action.skill != null
  }));
  return {
    parserId: `${profile.professionId}:${profile.specializationId}`,
    player,
    timelineOriginMs: origin,
    logStartTime: origin,
    combatStartTimestampMs: combatStart == null ? null : Math.max(0, combatStart - origin),
    actions,
    rotation: buildRotation(resolved, origin, combatStart),
    warnings: [...warningList(actions, resolved), ...interruptCommitWarnings]
  };
}
