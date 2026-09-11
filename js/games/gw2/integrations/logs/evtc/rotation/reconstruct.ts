import { LOG_OPENER_WARNING } from '#gw2/integrations/logs/lib/rotation/model.js';
import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { eiCustomAnimatedActions } from '#gw2/integrations/logs/evtc/rotation/ei-custom-casts.js';
import { eiChronomancerShatters, eiMinionSpawns } from '#gw2/integrations/logs/evtc/rotation/ei-minions.js';
import { usesModernAnimations, evtcRecordingWindow } from '#gw2/integrations/logs/evtc/recording.js';
import { selectPlayerAgent, selectedPlayerEvent } from '#gw2/integrations/logs/evtc/rotation/players.js';
import { modernAnimationActions, legacyActivationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';

import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';

import {
  EVTC_STATE_CHANGE,
  type EvtcRotationAction,
  type EvtcRotationPlayer,
  type ParsedEvtc
} from '#gw2/integrations/logs/evtc/types.js';
import {
  actionKind,
  findNamedRotationSkill,
  findRotationSkill,
  recordedActionSkill,
  skillIdentity,
  type RotationCatalog
} from '#gw2/integrations/logs/lib/rotation/catalog.js';
import {
  missingInterruptCommitWarnings,
  quicknessRuntimeDurationMs
} from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { type EvtcRotationProfessionProfile } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import {
  reconstructProfessionActions,
  type EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import type { ReconstructedCommand, RotationReconstructionBase } from '#gw2/integrations/logs/lib/rotation/model.js';
import { buildReplayTimeline } from '#gw2/integrations/logs/lib/rotation/timeline.js';
import { retainsReplayCastLockout } from '#gw2/integrations/logs/lib/rotation/timing.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';

const TIMING_TOLERANCE_MS = 50;

export interface EvtcRotationOptions {
  readonly playerAddress?: bigint | string;
  readonly includeCombatStart?: boolean;
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
  if (action.replayCastEnd != null && action.replayInterruptMs == null) {
    return null;
  }

  // Instant evidence has no observed cast duration; only animations or an explicit replay cutoff can cancel it.
  if (action.replayInterruptMs == null && action.evidence !== 'animation' && action.evidence !== 'legacy-activation')
    return null;

  const sourceObservedMs = Math.max(0, action.replayInterruptMs ?? action.end - action.start);
  if (sourceObservedMs === 0 && (action.status === 'instant' || action.status === 'unknown')) return null;
  const runtimeMs = action.replayDurationMs ?? quicknessRuntimeDurationMs(skill);
  // Snap every observed cancellation to the replay's 40 ms action grid, including per-packet channels.
  const observedMs = quantizeGw2ActionTimingMs(sourceObservedMs);
  return observedMs < runtimeMs ? observedMs : null;
}

/** Retains observed interruptions and marks atomic attempts below every declared cutoff as cancelled. */
function applyObservedInterruptTiming(
  actions: readonly RecordedAction[],
  catalog: RotationCatalog | null,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  return actions.map((action) => {
    const skill = recordedActionSkill(action, { catalog, profile });
    const interruptMs = observedInterruptMs(action, skill);
    if (interruptMs != null) {
      return { ...action, replayInterruptMs: interruptMs };
    }

    // Profession-resolved variants can be instant even when the base catalog skill has a cast time.
    const runtimeDuration = action.replayDurationMs ?? quicknessRuntimeDurationMs(skill);
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

function weaponSwapActions(log: ParsedEvtc, address: bigint): RecordedAction[] {
  return log.events.flatMap((event, eventIndex) => {
    if (!selectedPlayerEvent(event, address) || event.stateChange !== EVTC_STATE_CHANGE.WEAPON_SWAP) {
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

function isDodgeName(name: string): boolean {
  const value = name.trim().toLowerCase();
  return value === 'dodge' || value === 'dodge roll' || value === 'mirage cloak';
}

function resolveAction(
  action: RecordedAction,
  catalog: RotationCatalog | null,
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

  if (isDodgeName(action.rawName) && action.canonicalSkillId == null) {
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
    doubleEdgeOutcome?: 'success' | 'backfire';
  } = {
    name: action.name,
    skillId: action.skillId
  };
  if (action.offTarget === true) command.offTarget = true;
  const interruptMs = observedInterruptMs(action, action.skill);
  // Keep cancelled inputs explicit instead of replaying them as full damaging casts.
  if (interruptMs != null) command.interruptMs = interruptMs;

  if (action.doubleEdgeOutcome != null) {
    command.doubleEdgeOutcome = action.doubleEdgeOutcome;
  }

  return command;
}

/** Uses normalized replay timing while preserving EVTC boundaries needed to position overlapping actions. */
function replayActionEnd(action: ResolvedAction): number {
  const runtimeDuration = action.replayDurationMs ?? quicknessRuntimeDurationMs(action.skill);
  const observedReplayEnd =
    action.replayCastEnd ??
    (action.replayInterruptMs != null
      ? action.start + action.replayInterruptMs
      : action.status === 'completed' && runtimeDuration > 0
        ? Math.max(action.end, action.start + runtimeDuration)
        : action.end);
  // The command retains the observed interrupt, while timeline spacing remains anchored to the full aftercast.
  return retainsReplayCastLockout(action.skill, action.replayInterruptMs ?? action.end - action.start) &&
    runtimeDuration > 0
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
    // Serial replay can finish overlapping casts late; later waits must subtract time already spent in those casts.
    alignWaitsToSimulatorTiming: true,
    replayEnd: replayActionEnd,
    hasObservedCastTime: (action) =>
      action.status !== 'unknown' && (action.evidence === 'animation' || action.evidence === 'legacy-activation'),
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
  const inferred = actions.filter((action) => action.evidence === 'effect' || action.evidence === 'missile');
  const unsupported = actions.filter((action) => !action.supportedByCatalog);
  const unfinished = actions.filter((action) => action.status === 'unknown');
  const warnings: string[] = [LOG_OPENER_WARNING];
  if (inferred.length) {
    warnings.push(
      `${inferred.length} instant cast${inferred.length === 1 ? ' was' : 's were'} inferred using explicit Elite Insights rules.`
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

/** Orchestrates player selection, recorded evidence, profession inference, and replay assembly. */
export function reconstructWithProfile(
  log: ParsedEvtc,
  profile: EvtcRotationProfessionProfile,
  catalog: RotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): RotationReconstructionBase<EvtcRotationPlayer, EvtcRotationAction> {
  const { agent, player } = selectPlayerAgent(log, options.playerAddress);
  if (player.professionId !== profile.professionId || player.specializationId !== profile.specializationId) {
    throw new EvtcError(
      'UNSUPPORTED_PROFESSION',
      `The ${profile.professionName} ${profile.specializationName} parser cannot parse ${player.professionName} ${player.specializationName}.`
    );
  }

  // Eligibility limits inputs, not evidence: retain complete stops and split animations across the boundary.
  const encounterEnd = encounterEndTime(log);
  const inEncounter = (action: RecordedAction): boolean => encounterEnd == null || action.start < encounterEnd;
  const names = new Map(log.skills.map((skill) => [skill.id, skill.name]));
  const castActions = usesModernAnimations(log)
    ? modernAnimationActions(log, agent.address, names)
    : legacyActivationActions(log, agent.address, names);
  const combatStartEvent = log.events.find(
    (event) => selectedPlayerEvent(event, agent.address) && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  );
  // Preserve the recorded combat marker; absent encounter-specific parsing, the recording boundary is the fallback.
  const combatStart =
    options.includeCombatStart === false ? null : (combatStartEvent?.time ?? evtcRecordingWindow(log).start);
  const genericActions = [...castActions, ...weaponSwapActions(log, agent.address)];
  const professionContext = {
    log,
    playerAddress: agent.address,
    profile,
    catalog,
    recordedActions: genericActions,
    selectedSkillNames: options.selectedSkillNames,
    selectedSkillIds: options.selectedSkillIds,
    professionConfig: options.professionConfig,
    timelineOriginMs: Math.min(...genericActions.filter(inEncounter).map((a) => a.start), combatStart ?? Infinity)
  };
  const sourceActions = [
    ...genericActions,
    ...eiInstantActions(professionContext),
    ...eiCustomAnimatedActions(professionContext),
    ...eiChronomancerShatters(professionContext),
    ...eiMinionSpawns(professionContext)
  ].sort((a, b) => a.start - b.start || a.eventIndex - b.eventIndex);
  const normalized = reconstructProfessionActions({
    ...professionContext,
    recordedActions: sourceActions.filter((a) => a.castOrigin == null || a.castOrigin === 'skill')
  });
  const resolved = applyObservedInterruptTiming(normalized, catalog, profile)
    .filter(inEncounter)
    .map((action) => resolveAction(action, catalog, profile))
    .filter((action) => action.skill?.simulatorExcluded !== true);

  // Direct effect timestamps anchor instant inputs, including ammo flips; later idle time cannot move those inputs.
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
    metadataAccurate: action.metadataAccurate,
    eiRule: action.eiRule,
    castOrigin: action.castOrigin,
    status: action.status,
    ...(action.weaponSet === undefined ? {} : { weaponSet: action.weaponSet }),
    ...(action.doubleEdgeOutcome == null ? {} : { doubleEdgeOutcome: action.doubleEdgeOutcome }),
    ...(action.vindicatorDodgeAuto ? { vindicatorDodgeAuto: true } : {}),
    supportedByCatalog: action.skill != null
  }));
  return {
    parserId: `${profile.professionId}:${profile.specializationId}`,
    player,
    sourceActions: sourceActions.filter(inEncounter).map((action) => ({
      startMs: action.start,
      durationMs: action.end - action.start,
      rawSkillId: action.rawSkillId,
      status: action.status,
      metadataAccurate: action.metadataAccurate,
      acceleration: action.acceleration,
      savedDurationMs: action.savedDurationMs,
      eiRule: action.eiRule,
      castOrigin: action.castOrigin
    })),
    timelineOriginMs: origin,
    combatStartTimestampMs: combatStart == null ? null : Math.max(0, combatStart - origin),
    actions,
    rotation: buildRotation(resolved, origin, combatStart),
    warnings: [...warningList(actions), ...missingInterruptCommitWarnings(professionContext, resolved)]
  };
}
