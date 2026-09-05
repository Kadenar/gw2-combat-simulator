import { selectPlayerAgent, selectedPlayerEvent } from '#gw2/integrations/logs/evtc/rotation/players.js';
import {
  modernAnimationActions,
  legacyActivationActions,
  WEAPON_STOW_ANIMATION_ID
} from '#gw2/integrations/logs/evtc/rotation/animations.js';
import { TRANSITION_WINDOW_MS } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';

import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
  type EvtcRotationAction,
  type EvtcRotationPlayer,
  type ParsedEvtc,
  type ParsedEvtcEvent
} from '#gw2/integrations/logs/evtc/types.js';
import {
  actionKind,
  effectWindowMs,
  findNamedRotationSkill,
  findRotationSkill,
  isDirectPlayerSkill,
  recordedActionSkill,
  skillIdentity,
  type EvtcRotationCatalog
} from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import {
  missingInterruptCommitWarnings,
  quicknessRuntimeDurationMs,
  reconcileCastEffectPackets
} from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { type EvtcRotationProfessionProfile } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import {
  reconstructProfessionActions,
  type EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import type { ReconstructedCommand, RotationReconstructionBase } from '#gw2/integrations/logs/lib/rotation/model.js';
import { buildReplayTimeline, replayCombatStart } from '#gw2/integrations/logs/lib/rotation/timeline.js';
import { isUncommittedCast } from '#gw2/integrations/logs/lib/rotation/timing.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';

const TIMING_TOLERANCE_MS = 50;

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

/** Preserves shortened inputs so the scheduler applies explicit commit or per-packet cancellation rules. */
function observedInterruptMs(action: RecordedAction, skill: ReturnType<typeof findRotationSkill>): number | null {
  if (action.forceCompleteReplay === true || (action.replayCastEnd != null && action.replayInterruptMs == null)) {
    return null;
  }

  // Inferred setup spans are not observed cast durations; only recorded animations or explicit cutoffs can cancel them.
  if (action.replayInterruptMs == null && action.evidence !== 'animation' && action.evidence !== 'legacy-activation')
    return null;

  const sourceObservedMs = Math.max(0, action.replayInterruptMs ?? action.end - action.start);
  if (sourceObservedMs === 0 && (action.status === 'instant' || action.status === 'unknown')) return null;
  const runtimeMs = quicknessRuntimeDurationMs(skill);
  // Per-packet skills retain exact EVTC timing because rounding across a packet boundary changes which hits commit;
  // atomic cancellations still snap to the game's action tick.
  const observedMs =
    skill?.interruptMode === 'per-packet' ? sourceObservedMs : quantizeGw2ActionTimingMs(sourceObservedMs);
  return observedMs < runtimeMs ? observedMs : null;
}

/** Expands casts whose uncancellable aftercast keeps the simulator lane occupied through full completion. */
function applyRetainedCastLockouts(
  actions: readonly RecordedAction[],
  catalog: EvtcRotationCatalog | null,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  return actions.map((action) => {
    const skill = recordedActionSkill(action, { catalog, profile });
    if (skill?.retainsCastLockoutAfterInterrupt !== true) return action;
    // An observed interrupt remains explicit; the engine retains the serial
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

/** Retains observed interruptions and marks atomic attempts below every declared cutoff as cancelled. */
function applyObservedInterruptTiming(
  actions: readonly RecordedAction[],
  catalog: EvtcRotationCatalog | null,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  return actions.map((action) => {
    const skill = recordedActionSkill(action, { catalog, profile });
    const interruptMs = observedInterruptMs(action, skill);
    if (interruptMs != null) {
      const cancelled = isUncommittedCast(skill, interruptMs);
      return { ...action, status: cancelled ? 'interrupted' : action.status, replayInterruptMs: interruptMs };
    }

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
  existingActions: readonly RecordedAction[],
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
  const representedPrecasts = new Set(
    existingActions
      .filter((action) => action.precast === true)
      .map((action) => Number(action.canonicalSkillId ?? action.rawSkillId))
  );
  // Exclude lifecycle-detected summons already represented by a clipped activation before positioning the precast
  // chain; reserving and later discarding that cast creates a fake idle gap before combat.
  const detected = profile.initialSummons.filter(
    (summon) =>
      !representedPrecasts.has(Number(summon.action.skillId)) &&
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

  const skill = recordedActionSkill(action, { catalog, profile });
  return {
    ...action,
    skill,
    name: skill?.name || action.canonicalName || action.rawName,
    skillId: skill?.id ?? action.canonicalSkillId ?? action.rawSkillId
  };
}

function actionCommand(action: ResolvedAction): ReconstructedCommand {
  const command: {
    name: string;
    skillId?: string | number;
    offTarget?: boolean;
    offset?: number;
    interruptMs?: number;
    initialStateDurationMs?: number;
    doubleEdgeOutcome?: 'success' | 'backfire';
  } = {
    name: action.name,
    skillId: action.skillId
  };
  if (action.offTarget === true) command.offTarget = true;
  const interruptMs = observedInterruptMs(action, action.skill);
  // Keep cancelled inputs explicit instead of replaying them as full damaging casts.
  if (interruptMs != null) command.interruptMs = interruptMs;

  if (action.initialStateDurationMs != null) {
    command.initialStateDurationMs = action.initialStateDurationMs;
  }

  if (action.doubleEdgeOutcome != null) {
    command.doubleEdgeOutcome = action.doubleEdgeOutcome;
  }

  return command;
}

/** Uses normalized replay timing while preserving EVTC boundaries needed to position overlapping actions. */
function replayActionEnd(action: ResolvedAction): number {
  const runtimeDuration = quicknessRuntimeDurationMs(action.skill);
  const observedReplayEnd =
    action.replayCastEnd ??
    (action.replayInterruptMs != null
      ? action.start + action.replayInterruptMs
      : action.status === 'completed' && runtimeDuration > 0
        ? Math.max(action.end, action.start + runtimeDuration)
        : action.end);
  // The command retains the observed interrupt, while timeline spacing remains anchored to the full aftercast.
  return action.skill?.retainsCastLockoutAfterInterrupt === true && runtimeDuration > 0
    ? Math.max(observedReplayEnd, action.start + runtimeDuration)
    : observedReplayEnd;
}

function buildRotation(
  actions: readonly ResolvedAction[],
  origin: number,
  combatStart: number | null
): ReconstructedCommand[] {
  return buildReplayTimeline(actions, origin, combatStart, {
    timingToleranceMs: TIMING_TOLERANCE_MS,
    quantizeMs: quantizeGw2ActionTimingMs,
    replayEnd: replayActionEnd,
    hasObservedCastTime: (action) =>
      action.suppressFollowingWait !== true &&
      action.status !== 'unknown' &&
      (action.evidence === 'animation' || action.evidence === 'legacy-activation'),
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

function warningList(actions: readonly EvtcRotationAction[]): string[] {
  const inferred = actions.filter((action) => action.evidence === 'effect');
  const unsupported = actions.filter((action) => !action.supportedByCatalog);
  const unfinished = actions.filter((action) => action.status === 'unknown');
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

/** Orchestrates player selection, recorded evidence, profession inference, and replay assembly. */
export function reconstructWithProfile(
  log: ParsedEvtc,
  profile: EvtcRotationProfessionProfile,
  catalog: EvtcRotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): RotationReconstructionBase<EvtcRotationPlayer, EvtcRotationAction> {
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
        (action.end <= action.start || recordedActionSkill(action, { catalog, profile }) == null)
      )
  );
  const professionContext = {
    log,
    playerAddress: agent.address,
    profile,
    catalog,
    // Resolve split animations before interpreting a segment's duration as a cancellation of the whole skill.
    recordedActions: genericActions,
    selectedSkillNames: options.selectedSkillNames,
    selectedSkillIds: options.selectedSkillIds,
    professionConfig: options.professionConfig,
    timelineOriginMs: Math.min(
      ...genericActions.map((action) => action.start),
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
    professionActions,
    Math.min(
      ...professionActions.map((action) => action.start),
      combatStart == null ? Number.POSITIVE_INFINITY : combatStart
    )
  );
  const recorded = [...initialSummons, ...professionActions];
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
    combatStartTimestampMs: combatStart == null ? null : Math.max(0, combatStart - origin),
    actions,
    rotation: buildRotation(resolved, origin, combatStart),
    warnings: [...warningList(actions), ...interruptCommitWarnings]
  };
}
