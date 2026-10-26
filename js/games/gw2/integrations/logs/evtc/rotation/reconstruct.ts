import { prepareEvtcEvidence, type EvtcReconstructionEvidence } from '#gw2/integrations/logs/evtc/rotation/evidence.js';
import { rotationActionSummary } from '#gw2/integrations/logs/shared/rotation/summary.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import { replayActionCommand } from '#gw2/integrations/logs/shared/rotation/commands.js';
import {
  isMushroomKingsBlessing,
  isWeaponStow,
  LOG_OPENER_WARNING
} from '#gw2/integrations/logs/shared/rotation/model.js';
import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { eiCustomAnimatedActions } from '#gw2/integrations/logs/evtc/rotation/ei-custom-casts.js';
import {
  eiChronomancerShatters,
  eiMesmerPhaseRetreat,
  eiMesmerShatters,
  eiMinionSpawns,
  rangerPetActions
} from '#gw2/integrations/logs/evtc/rotation/ei-minions.js';
import { evtcRecordingWindow } from '#gw2/integrations/logs/evtc/recording.js';
import {
  detectEvtcRotationPlayers,
  selectPlayerAgent,
  selectedPlayerEvent,
  type EvtcPlayerEvidence
} from '#gw2/integrations/logs/evtc/rotation/players.js';

import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { encounterEndTime, encounterStartTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import {
  antiquaryChakShieldActions,
  deadeyeMarkActions,
  thiefShadowBoltInterruptMs,
  thiefThousandNeedlesActions,
  thiefStealActions
} from '#gw2/integrations/logs/evtc/rotation/professions/thief.js';

import {
  EVTC_STATE_CHANGE,
  type EvtcRotationAction,
  type EvtcRotationPlayer,
  type ParsedEvtc
} from '#gw2/integrations/logs/evtc/types.js';
import {
  findNamedRotationSkill,
  createRotationSkillResolver,
  findRotationSkill,
  recordedActionSkill,
  resolvedActionIdentity,
  skillIdentity,
  type RotationCatalog
} from '#gw2/integrations/logs/shared/rotation/catalog.js';
import { createStrikePacketMatcher, referenceCastTimeMs } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { evtcRotationProfile } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { reconstructProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import { restoreConduitHazeOpener } from '#gw2/integrations/logs/evtc/rotation/professions/conduit.js';
import type { EvtcRecordedRotationAction } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import type { ResolvedLogAction } from '#gw2/integrations/logs/shared/rotation/normalization.js';
import type { RotationReconstructionBase } from '#gw2/integrations/logs/shared/rotation/model.js';
import { buildReplayTimeline } from '#gw2/integrations/logs/shared/rotation/timeline.js';
import { retainsReplayCastLockout } from '#gw2/integrations/logs/shared/rotation/timing.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';

const TIMING_TOLERANCE_MS = 50;

export interface EvtcRotationOptions {
  readonly playerAddress?: bigint | string;
  /** Reuse evidence already decoded for the same log by an app or CLI player picker. */
  readonly playerEvidence?: readonly EvtcPlayerEvidence[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}

type RecordedAction = EvtcRecordedRotationAction;

type ResolvedAction = ResolvedLogAction<RecordedAction>;

/** Preserves shortened inputs so the scheduler applies explicit commit or per-packet cancellation rules. */
function observedInterruptMs(action: RecordedAction, skill: ReturnType<typeof findRotationSkill>): number | null {
  // Independent pet animations only cancel on an explicit interruption, not a shorter completed animation.
  if (skill?.independentCast && action.status !== 'interrupted') return null;

  if (action.replayCastEnd != null && action.replayInterruptMs == null) {
    return null;
  }

  // Instant evidence has no observed cast duration; only animations or an explicit replay cutoff can cancel it.
  if (action.replayInterruptMs == null && action.evidence !== 'animation' && action.evidence !== 'legacy-activation')
    return null;

  const sourceObservedMs = Math.max(0, action.replayInterruptMs ?? action.end - action.start);

  if (sourceObservedMs === 0 && (action.status === 'instant' || action.status === 'unknown')) return null;

  const runtimeMs = action.replayDurationMs ?? referenceCastTimeMs(skill);
  // Snap every observed cancellation to the replay's 40 ms action grid, including per-packet channels.
  const observedMs = thiefShadowBoltInterruptMs(action) ?? quantizeGw2ActionTimingMs(sourceObservedMs);
  return observedMs < runtimeMs ? observedMs : null;
}

/** Retains observed interruptions and marks atomic attempts below every declared cutoff as cancelled. */
function applyObservedInterruptTiming(
  actions: readonly RecordedAction[],
  catalog: RotationCatalog | null,
  profile: RotationProfessionProfile,
  validatePackets: ReturnType<typeof createStrikePacketMatcher>
): RecordedAction[] {
  return actions.map((action) => {
    const skill = recordedActionSkill(action, { catalog, profile });
    const interruptMs = observedInterruptMs(action, skill);

    // Apply Shadow Bolt's raw-duration guard before tolerant packet matching can promote a short attempt to completion.
    if (interruptMs != null && thiefShadowBoltInterruptMs(action) != null) {
      return { ...action, replayInterruptMs: interruptMs, replayCastEnd: undefined };
    }

    const runtimeDuration = action.replayDurationMs ?? referenceCastTimeMs(skill);
    const packets = validatePackets(action);
    const falseZeroDurationCancellation =
      action.status === 'interrupted' &&
      action.end === action.start &&
      packets.allObserved &&
      packets.allObservedTimingExplicit;

    if (runtimeDuration > 0 && (packets.observedCommittedDelayedPacket || falseZeroDurationCancellation)) {
      // Proven packets override a false stop marker so replay retains the complete cast and its damage.
      return {
        ...action,
        replayCastEnd: action.start + runtimeDuration,
        replayInterruptMs: undefined
      };
    }

    if (interruptMs != null) {
      return { ...action, replayInterruptMs: interruptMs };
    }

    // Profession-resolved variants can be instant even when the base catalog skill has a cast time.
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
        expectedDurationMs: 0,
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
  return value === 'dodge' || value === 'dodge roll';
}

function resolveAction(
  action: RecordedAction,
  catalog: RotationCatalog | null,
  profile: RotationProfessionProfile
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
  return { ...action, ...resolvedActionIdentity(action, skill) };
}

/** Uses normalized replay timing while preserving EVTC boundaries needed to position overlapping actions. */
function replayActionEnd(action: ResolvedAction): number {
  const runtimeDuration = action.replayDurationMs ?? referenceCastTimeMs(action.skill);
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
): RotationCommand[] {
  return buildReplayTimeline(actions, origin, combatStart, {
    timingToleranceMs: TIMING_TOLERANCE_MS,
    quantizeMs: quantizeGw2ActionTimingMs,
    replayEnd: replayActionEnd,
    hasObservedCastTime: (action) =>
      action.status !== 'unknown' && (action.evidence === 'animation' || action.evidence === 'legacy-activation'),
    commandFor: (action) => replayActionCommand(action, observedInterruptMs(action, action.skill)),
    canEmit: (action) =>
      action.skill != null ||
      action.rawName === 'Swap Weapons' ||
      isDodgeName(action.rawName) ||
      isMushroomKingsBlessing(action),
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
  // Import notices identify missing or incomplete input that the user may need to correct.
  const unsupported = actions.filter(
    (action) => !action.supportedByCatalog && !isMushroomKingsBlessing(action) && !isWeaponStow(action)
  );
  const unfinished = actions.filter((action) => action.status === 'unknown');
  const warnings: string[] = [LOG_OPENER_WARNING];

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

/** Reuses the selected player's decoded casts for profession inference and replay assembly. */
function reconstructWithProfile(
  log: ParsedEvtc,
  { agent, player, castActions }: EvtcPlayerEvidence,
  profile: RotationProfessionProfile,
  evidence: EvtcReconstructionEvidence,
  catalog: RotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): RotationReconstructionBase<EvtcRotationPlayer, EvtcRotationAction> {
  // Eligibility limits inputs, not evidence: retain complete stops and split animations across the boundary.
  const encounterEnd = encounterEndTime(log);
  const inEncounter = (action: RecordedAction): boolean => encounterEnd == null || action.start < encounterEnd;
  const combatStartEvent = log.events.find(
    (event) => selectedPlayerEvent(event, agent.address) && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  );
  // Always infer the combat boundary so every replay uses encounter evidence before player snapshots or recording start.
  const combatStart = encounterStartTime(log) ?? combatStartEvent?.time ?? evtcRecordingWindow(log).start;
  const genericActions = [...castActions, ...weaponSwapActions(log, agent.address)];
  const professionContext = {
    log,
    evidence,
    playerAddress: agent.address,
    profile,
    catalog,
    recordedActions: genericActions,
    professionConfig: options.professionConfig
  };
  const petActions = rangerPetActions(professionContext);
  // Prefer owned pet animations per cast, preserving an opening marker when its pet animation was not recorded.
  const playerActions = [
    ...genericActions,
    ...deadeyeMarkActions(professionContext),
    ...thiefStealActions(professionContext),
    ...eiInstantActions(professionContext),
    ...eiCustomAnimatedActions(professionContext),
    ...eiMesmerPhaseRetreat(professionContext),
    ...eiMesmerShatters(professionContext),
    ...eiChronomancerShatters(professionContext),
    ...eiMinionSpawns(professionContext)
  ];
  // Corroborated shield placements fill missing instant inputs without duplicating EI's complete visual evidence.
  playerActions.push(...antiquaryChakShieldActions({ ...professionContext, recordedActions: playerActions }));
  // Owned damage corroborates delayed preparation visuals without relaxing the upstream EI rules.
  playerActions.push(...thiefThousandNeedlesActions({ ...professionContext, recordedActions: playerActions }));
  const sourceActions = [
    ...playerActions.filter(
      (action) =>
        !petActions.some(
          (pet) =>
            pet.rawSkillId === action.rawSkillId &&
            action.start >= pet.start - TIMING_TOLERANCE_MS &&
            action.start <= pet.end + TIMING_TOLERANCE_MS
        )
    ),
    ...petActions
  ].sort((a, b) => a.start - b.start || a.eventIndex - b.eventIndex);
  const normalized = reconstructProfessionActions({
    ...professionContext,
    recordedActions: sourceActions.filter((a) => a.castOrigin == null || a.castOrigin === 'skill')
  });
  const completeOpener = restoreConduitHazeOpener(
    { ...professionContext, recordedActions: sourceActions },
    normalized,
    combatStart
  );
  // Use normalized swaps for both packet evidence and replay; raw bar-change signals may have been removed.
  const timingContext = { ...professionContext, recordedActions: completeOpener };
  const resolveSkill = createRotationSkillResolver(timingContext);
  const resolved = applyObservedInterruptTiming(
    completeOpener,
    catalog,
    profile,
    createStrikePacketMatcher(timingContext)
  )
    .filter(inEncounter)
    .map((action) => resolveAction(action, catalog, profile))
    // Capture the same conditional cutoff used by runtime cancellation and replay occupancy.
    .map((action) => ({ ...action, skill: resolveSkill(action, action.skill) }))
    .filter((action) => action.skill?.simulatorExcluded !== true);

  // Direct effect timestamps anchor instant inputs, including ammo flips; later idle time cannot move those inputs.
  resolved.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);

  if (!resolved.length) {
    throw new EvtcError('NO_ROTATION_ACTIONS', 'The selected player has no reconstructable EVTC actions.');
  }

  const origin = Math.min(resolved[0].start, combatStart == null ? Number.POSITIVE_INFINITY : combatStart);
  const actions: EvtcRotationAction[] = resolved.map((action) => ({
    ...rotationActionSummary(action, origin),
    evidence: action.evidence,
    metadataAccurate: action.metadataAccurate,
    eiRule: action.eiRule,
    castOrigin: action.castOrigin,
    ...(action.weaponSet === undefined ? {} : { weaponSet: action.weaponSet }),
    ...(action.doubleEdgeOutcome == null ? {} : { doubleEdgeOutcome: action.doubleEdgeOutcome }),
    ...(action.vindicatorDodgeAuto ? { vindicatorDodgeAuto: true } : {})
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
    combatStartTimestampMs: combatStart == null ? null : Math.max(0, combatStart - origin),
    actions,
    rotation: buildRotation(resolved, origin, combatStart),
    warnings: [
      ...warningList(actions),
      // A Gaze snapshot proves an existing mark, but cannot reconstruct the missing opener or its stored resources.
      ...(profile.specializationId === 'deadeye' &&
      log.events.some(
        (event) =>
          event.skillId === 46333 &&
          event.target === agent.address &&
          event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
      )
        ? [
            "Deadeye's Mark was already active when recording began. Review the missing pre-combat Mark and opener before simulating."
          ]
        : [])
    ]
  };
}

/** Selects an EVTC player and reconstructs it with the matching shared profession profile. */
export function reconstructEvtcRotation(
  log: ParsedEvtc,
  catalog: RotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): RotationReconstructionBase<EvtcRotationPlayer, EvtcRotationAction> {
  const playerEvidence = options.playerEvidence ?? detectEvtcRotationPlayers(log);
  const selected = selectPlayerAgent(playerEvidence, options.playerAddress);
  const { player } = selected;
  const profile = evtcRotationProfile(player.professionId, player.specializationId);

  if (!profile) {
    throw new EvtcError(
      'UNSUPPORTED_PROFESSION',
      `No EVTC rotation parser is registered for ${player.professionName} ${player.specializationName}.`
    );
  }

  return reconstructWithProfile(log, selected, profile, prepareEvtcEvidence(log, playerEvidence), catalog, options);
}
