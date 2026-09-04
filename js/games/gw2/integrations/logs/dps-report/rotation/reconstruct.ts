import {
  actionKind,
  findNamedRotationSkill,
  normalizedName as normalized,
  recordedActionSkill,
  skillIdentity
} from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type { RotationCatalog } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type {
  ReconstructedCommand,
  ReconstructedRotationCommand,
  RotationActionStatus
} from '#gw2/integrations/logs/lib/rotation/model.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { buildReplayTimeline, replayCombatStart } from '#gw2/integrations/logs/lib/rotation/timeline.js';
import { firstStrikePacketOffsetMs } from '#gw2/integrations/logs/lib/rotation/timing.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import {
  GW2_ACTION_TICK_MS,
  observedCommittedInterruptMs,
  quantizeGw2ActionTimingMs,
  quicknessReferenceCastTimeMs
} from '#gw2/platform/skills/timing.js';
import { DpsReportError } from '#gw2/integrations/logs/dps-report/errors.js';
import type {
  DpsReportCast,
  DpsReportPhase,
  DpsReportPlayer,
  DpsReportRotationAction,
  DpsReportRotationPlayer,
  DpsReportRotationReconstruction,
  DpsReportSkillMetadata,
  ParsedDpsReport
} from '#gw2/integrations/logs/dps-report/types.js';
import { dpsReportRotationProfile } from '#gw2/integrations/logs/dps-report/rotation/profiles.js';
import { reconstructDpsReportProfessionActions } from '#gw2/integrations/logs/dps-report/rotation/professions/index.js';
import type {
  DpsReportRecordedAction,
  DpsReportResolvedAction,
  DpsReportRotationOptions
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const TIMING_TOLERANCE_MS = 50;
const DUPLICATE_SIGNAL_WINDOW_MS = 75;
// An autoattack lands its strike near the end of its cast. Elite Insights reports
// each cast's observed duration alongside the nominal length it would have run
// (duration + timeGained); a completed autoattack covers ~0.82 of that nominal
// length before its strike commits. A cast that stopped well short of the strike
// was cancelled and must not enter the rotation — an emitted phantom autoattack
// would wrongly advance the weapon-1 chain and desync every following chain skill.
const AUTOATTACK_COMMIT_FRACTION = 0.7;

function automaticProc(metadata: DpsReportSkillMetadata | null): boolean {
  return Boolean(metadata?.isTraitProc || metadata?.isUnconditionalProc || metadata?.isGearProc);
}

function skillMetadata(report: ParsedDpsReport, skillId: number): DpsReportSkillMetadata | null {
  return report.skillMap[`s${skillId}`] || null;
}

function recordedActionCount(report: ParsedDpsReport, player: DpsReportPlayer): number {
  return player.rotation.reduce((count, group) => {
    return count + (automaticProc(skillMetadata(report, group.id)) ? 0 : group.skills.length);
  }, 0);
}

/** Lists supported EI players in descending order of usable cast evidence. */
export function detectDpsReportRotationPlayers(report: ParsedDpsReport): readonly DpsReportRotationPlayer[] {
  return report.players
    .flatMap((player, index) => {
      const profile = dpsReportRotationProfile(player.profession);
      if (!profile) return [];
      return [
        {
          index,
          character: player.name,
          account: player.account || '',
          professionId: profile.professionId,
          professionName: profile.professionName,
          specializationId: profile.specializationId,
          specializationName: profile.specializationName,
          recordedActionCount: recordedActionCount(report, player)
        }
      ];
    })
    .sort((left, right) => right.recordedActionCount - left.recordedActionCount || left.index - right.index);
}

function phaseFor(report: ParsedDpsReport, phaseIndex: number | undefined): { phase: DpsReportPhase; index: number } {
  const index = phaseIndex ?? 0;
  if (!Number.isInteger(index) || index < 0 || index >= report.phases.length) {
    throw new DpsReportError('PHASE_NOT_FOUND', 'The requested phase is not present in the Elite Insights report.', {
      phaseIndex: index
    });
  }

  return { phase: report.phases[index], index };
}

function castIntersectsPhase(cast: DpsReportCast, phase: DpsReportPhase): boolean {
  if (cast.duration <= 0) return cast.castTime >= phase.start && cast.castTime < phase.end;
  return cast.castTime < phase.end && cast.castTime + cast.duration >= phase.start;
}

function duplicateDetectionSignal(
  cast: DpsReportCast,
  casts: readonly DpsReportCast[],
  metadata: DpsReportSkillMetadata | null
): boolean {
  if (cast.duration !== 0 || metadata?.isNotAccurate !== true) return false;
  return casts.some(
    (candidate) =>
      candidate !== cast &&
      candidate.duration > 0 &&
      Math.abs(cast.castTime - (candidate.castTime + candidate.duration)) <= DUPLICATE_SIGNAL_WINDOW_MS
  );
}

function castStatus(cast: DpsReportCast): RotationActionStatus {
  if (cast.duration <= 0) return 'instant';
  if (Number(cast.timeGained || 0) < 0) return 'interrupted';
  if (Number(cast.timeGained || 0) > 0) return 'reduced';
  return 'completed';
}

function recordedActions(
  report: ParsedDpsReport,
  player: DpsReportPlayer,
  phase: DpsReportPhase
): { actions: DpsReportRecordedAction[]; ignoredAutomaticProcs: number; ignoredDuplicateSignals: number } {
  const actions: DpsReportRecordedAction[] = [];
  let ignoredAutomaticProcs = 0;
  let ignoredDuplicateSignals = 0;
  let eventIndex = 0;
  for (const group of player.rotation) {
    const metadata = skillMetadata(report, group.id);
    if (automaticProc(metadata)) {
      ignoredAutomaticProcs += group.skills.length;
      continue;
    }

    for (const cast of group.skills) {
      if (!castIntersectsPhase(cast, phase)) continue;
      if (duplicateDetectionSignal(cast, group.skills, metadata)) {
        ignoredDuplicateSignals += 1;
        continue;
      }

      const duration = Math.max(0, cast.duration);
      actions.push({
        start: cast.castTime,
        end: cast.castTime + duration,
        rawSkillId: group.id,
        rawName: metadata?.name?.replace(/^"|"$/g, '') || `Unknown ${group.id}`,
        status: castStatus(cast),
        eventIndex,
        isSwap: metadata?.isSwap === true,
        metadataAccurate: metadata?.isNotAccurate !== true,
        expectedDurationMs: duration + Math.max(0, Number(cast.timeGained || 0))
      });
      eventIndex += 1;
    }
  }

  actions.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  return { actions, ignoredAutomaticProcs, ignoredDuplicateSignals };
}

function selectedSkillForAction(
  action: DpsReportRecordedAction,
  profile: RotationProfessionProfile,
  catalog: RotationCatalog | null,
  selectedSkillIds: readonly number[] | undefined
): Skill | null {
  if (!catalog || !selectedSkillIds?.length) return null;
  const selected = new Set(selectedSkillIds.map(Number).filter(Number.isFinite));
  const resolvedName = recordedActionSkill(action, { catalog, profile })?.name;
  const name = normalized(resolvedName || action.canonicalName || action.rawName);
  return (
    catalog.skills.find(
      (skill) => typeof skill.id === 'number' && selected.has(Number(skill.id)) && normalized(skill.name) === name
    ) || null
  );
}

function resolveAction(
  action: DpsReportRecordedAction,
  profile: RotationProfessionProfile,
  catalog: RotationCatalog | null,
  selectedSkillIds: readonly number[] | undefined
): DpsReportResolvedAction {
  if (action.isSwap && normalized(action.rawName) === 'weapon swap') {
    const skill = findNamedRotationSkill(profile.weaponSwap.name, catalog, profile);
    return { ...action, skill, ...skillIdentity(skill, profile.weaponSwap) };
  }

  const selected = selectedSkillForAction(action, profile, catalog, selectedSkillIds);
  const skill = selected || recordedActionSkill(action, { catalog, profile });
  return {
    ...action,
    skill,
    name: skill?.name || action.canonicalName || action.rawName,
    skillId: skill?.id ?? action.canonicalSkillId ?? action.rawSkillId
  };
}

/** Returns a safe, action-tick-aligned observed duration only when the skill declares its commit contract. */
function observedInterruptMs(action: DpsReportResolvedAction): number | null {
  const sourceDurationMs = action.end - action.start;
  const quantizedDurationMs = quantizeGw2ActionTimingMs(sourceDurationMs);
  const runtimeDurationMs = quicknessReferenceCastTimeMs(action.skill);
  // Per-packet channels can safely replay any shortened observed duration because the scheduler retains only landed packets.
  if (
    action.skill?.interruptMode === 'per-packet' &&
    quantizedDurationMs > 0 &&
    quantizedDurationMs < runtimeDurationMs
  ) {
    return quantizedDurationMs;
  }

  const observedMs = observedCommittedInterruptMs(action.skill, sourceDurationMs);
  if (observedMs != null || action.status === 'interrupted') return observedMs;

  const commitMs = Number(action.skill?.interruptCommitMs);
  // EI reduced-aftercast rows can end just before the packet-backed commit, so clamp only nearby completed casts.
  if (
    quantizedDurationMs > 0 &&
    Number.isFinite(commitMs) &&
    quantizedDurationMs < commitMs &&
    commitMs - quantizedDurationMs <= 2 * GW2_ACTION_TICK_MS
  ) {
    return observedCommittedInterruptMs(action.skill, commitMs);
  }

  return null;
}

function actionCommand(action: DpsReportResolvedAction): ReconstructedRotationCommand {
  const command: {
    name: string;
    skillId: string | number;
    offset?: number;
    interruptMs?: number;
    doubleEdgeOutcome?: 'success' | 'backfire';
  } = { name: action.name, skillId: action.skillId };
  const interruptMs = action.replayInterruptMs ?? observedInterruptMs(action);
  // EI's observed cast duration is authoritative only when catalog metadata
  // proves that replaying it will not cancel the skill before it commits.
  if (interruptMs != null) command.interruptMs = interruptMs;
  if (action.doubleEdgeOutcome != null) command.doubleEdgeOutcome = action.doubleEdgeOutcome;

  return command;
}

/** Replaces shortened report timing when a skill's aftercast cannot release the simulator cast lane early. */
function applyRetainedCastLockout(action: DpsReportResolvedAction): DpsReportResolvedAction {
  if (action.skill?.retainsCastLockoutAfterInterrupt !== true) return action;
  // Safe observed durations are replayed as interruptions; the scheduler then
  // retains the ordinary cast lane while still allowing instant actions.
  if (observedInterruptMs(action) != null) return action;
  const runtimeDuration = quicknessReferenceCastTimeMs(action.skill);
  if (!(runtimeDuration > 0) || action.end - action.start >= runtimeDuration) return action;
  return {
    ...action,
    end: action.start + runtimeDuration,
    status: 'completed'
  };
}

/** Keeps retained aftercast occupied in replay without encoding that same interval as a separate wait. */
function replayActionEnd(action: DpsReportResolvedAction, completeReportedAftercast = false): number {
  if (action.replayInterruptMs != null) return action.start + action.replayInterruptMs;
  // A packet-proven combat marker inside an opening cast must use the
  // simulator's cast lane, not EI's slightly shorter animation observation.
  if (action.combatStartOverride != null) {
    const runtimeDuration = quicknessReferenceCastTimeMs(action.skill);
    if (runtimeDuration > 0) return Math.max(action.end, action.start + runtimeDuration);
  }

  if (action.skill?.retainsCastLockoutAfterInterrupt === true) {
    const runtimeDuration = quicknessReferenceCastTimeMs(action.skill);
    return runtimeDuration > 0 ? Math.max(action.end, action.start + runtimeDuration) : action.end;
  }

  // Timeline waits begin after the same safe interruption encoded in the replay command, including tick snapping.
  const interruptMs = observedInterruptMs(action);
  if (interruptMs != null) return action.start + interruptMs;
  if (!completeReportedAftercast) return action.end;
  const runtimeDuration = quicknessReferenceCastTimeMs(action.skill);
  return runtimeDuration > 0 ? Math.max(action.end, action.start + runtimeDuration) : action.end;
}

function instantReplayAction(action: DpsReportResolvedAction): boolean {
  return action.status === 'instant' || action.end <= action.start || Number(action.skill?.castTimeMs) === 0;
}

/** Uses weapon swaps, plus Forge entry for weapon skills, as safe cancellation boundaries. */
function applyCastInterrupts(actions: readonly DpsReportResolvedAction[]): DpsReportResolvedAction[] {
  const replay = [...actions];
  for (let boundaryIndex = 0; boundaryIndex < replay.length; boundaryIndex += 1) {
    const boundary = replay[boundaryIndex];
    const weaponSwap = boundary.isSwap && normalized(boundary.rawName) === 'weapon swap';
    const forgeEntry = normalized(boundary.name) === 'enter radiant forge';
    if (!weaponSwap && !forgeEntry) continue;

    for (let castIndex = boundaryIndex - 1; castIndex >= 0; castIndex -= 1) {
      const cast = replay[castIndex];
      if (instantReplayAction(cast)) continue;
      if (cast.end <= boundary.start) break;
      if (forgeEntry && normalized(cast.skill?.type) !== 'weapon') break;
      const interruptMs = observedCommittedInterruptMs(cast.skill, boundary.start - cast.start);
      if (interruptMs != null) replay[castIndex] = { ...cast, replayInterruptMs: interruptMs };
      break;
    }
  }

  return replay;
}

/** Runs simultaneous instant inputs before cast-time skills, preserving EI order within each class. */
function compareSimultaneousActions(left: DpsReportResolvedAction, right: DpsReportResolvedAction): number {
  return Number(instantReplayAction(right)) - Number(instantReplayAction(left)) || left.eventIndex - right.eventIndex;
}

function compareResolvedActions(left: DpsReportResolvedAction, right: DpsReportResolvedAction): number {
  return left.start - right.start || compareSimultaneousActions(left, right);
}

/** Keeps only autoattacks with report evidence that their first packet committed. */
function autoattackCommitted(report: ParsedDpsReport, action: DpsReportResolvedAction): boolean {
  if (skillMetadata(report, action.rawSkillId)?.autoAttack !== true) return true;
  // EI's reduced-aftercast rows are completed inputs; only cancelled rows need packet-commit validation.
  if (action.status !== 'interrupted') return true;
  const actualDurationMs = action.end - action.start;
  const expectedDurationMs = Number(action.expectedDurationMs || 0);
  if (expectedDurationMs <= 0) return true;
  // Prefer an explicit simulator cast time when EI's nominal duration includes
  // a long aftercast; the modeled cast lane is the tighter commitment bound.
  const runtimeDurationMs = Math.max(0, Number(action.skill?.quicknessCastTimeMs || action.skill?.castTimeMs || 0));
  const explicitCommitOffsets = [
    action.skill?.interruptCommitMs,
    ...(action.skill?.effects || []).map((effect) => effect.interruptCommitMs)
  ]
    .map(Number)
    // Zero-value legacy metadata is not evidence that an autoattack packet committed immediately.
    .filter((value) => Number.isFinite(value) && value > 0);
  const explicitCommitOffsetMs = explicitCommitOffsets.length ? Math.min(...explicitCommitOffsets) : null;
  if (explicitCommitOffsetMs != null) {
    return actualDurationMs + TIMING_TOLERANCE_MS >= explicitCommitOffsetMs;
  }
  // Explicit packet timing is the precise commitment contract for attacks such as Guardian pistol's early projectile.

  const firstStrikeOffsetMs = firstStrikePacketOffsetMs(action.skill, runtimeDurationMs, { explicitOnly: true });
  if (firstStrikeOffsetMs != null) return actualDurationMs + TIMING_TOLERANCE_MS >= firstStrikeOffsetMs;
  const commitmentDurationMs =
    action.status === 'interrupted' && runtimeDurationMs > 0
      ? runtimeDurationMs
      : runtimeDurationMs > 0
        ? Math.min(expectedDurationMs, runtimeDurationMs)
        : expectedDurationMs;
  return actualDurationMs >= commitmentDurationMs * AUTOATTACK_COMMIT_FRACTION;
}

/** Keeps a pre-phase cast's explicit opening strike from landing before reconstructed combat begins. */
function alignOpeningStrikeCombatStart(
  actions: readonly DpsReportResolvedAction[],
  sourceCombatStart: number
): DpsReportResolvedAction[] {
  return actions.map((action) => {
    if (action.inference != null || action.start > sourceCombatStart || action.end < sourceCombatStart) return action;
    const strikeOffset = firstStrikePacketOffsetMs(action.skill, quicknessReferenceCastTimeMs(action.skill), {
      explicitOnly: true
    });
    if (strikeOffset == null || action.start + strikeOffset >= sourceCombatStart) return action;

    const strikeAt = action.start + strikeOffset;
    const existingOverride = Number(action.combatStartOverride);
    return {
      ...action,
      combatStartOverride: Number.isFinite(existingOverride) ? Math.min(existingOverride, strikeAt) : strikeAt
    };
  });
}

function buildRotation(
  actions: readonly DpsReportResolvedAction[],
  origin: number,
  combatStart: number,
  completeReportedAftercast: boolean
): ReconstructedCommand[] {
  return buildReplayTimeline(actions, origin, combatStart, {
    // EI's cast/aftercast split leaves up to two action ticks of residue between otherwise continuous inputs.
    minimumWaitMs: completeReportedAftercast ? 2 * GW2_ACTION_TICK_MS : 0,
    // Imported idle gaps share the same action-tick precision as observed cast durations.
    quantizeWaitMs: quantizeGw2ActionTimingMs,
    // EI source durations can be shorter than simulator casts, so later waits absorb that accumulated difference.
    alignWaitsToSimulatorTiming: true,
    commandFor: actionCommand,
    // Troubadour EI animations omit ordinary aftercast; its measured catalog cadence already models that occupied lane.
    replayEnd: (action) => replayActionEnd(action, completeReportedAftercast),
    hasObservedCastTime: (action) => action.inference == null,
    compareSimultaneousActions,
    // Weapon Swap is a supported simulator action even when no catalog entry was supplied.
    canEmit: (action) => action.skill != null || (action.isSwap && normalized(action.rawName) === 'weapon swap')
  });
}

function warningList(
  actions: readonly DpsReportRotationAction[],
  resolved: readonly DpsReportResolvedAction[]
): string[] {
  const warnings = [
    'Source limitation: dps.report may omit instant casts and pre-combat state. Review the imported opening.'
  ];
  const unsupported = actions.filter((action) => !action.supportedByCatalog);
  const interrupted = actions.filter((action) => action.status === 'interrupted');
  const recoveredSetup = [
    ...new Set(
      resolved
        .filter(
          (action) =>
            action.inference != null &&
            action.inference !== 'elementalist-aura' &&
            action.inference !== 'elementalist-blinding-flash' &&
            action.inference !== 'elementalist-damage-evidence' &&
            action.inference !== 'ranger-damage-evidence' &&
            action.control == null &&
            !(action.inference === 'initial-kit' && action.skill?.handlerId === 'engineer.kit-stow')
        )
        .map((action) => action.name)
    )
  ];
  if (recoveredSetup.length) {
    const setup =
      recoveredSetup.length === 1
        ? recoveredSetup[0]
        : `${recoveredSetup.slice(0, -1).join(', ')} and ${recoveredSetup.at(-1)}`;
    warnings.push(`Recovered setup: added the missing ${setup} from dependent casts.`);
  }

  const recoveredReportEvidence = [
    ...new Set(
      resolved
        .filter(
          (action) =>
            action.inference === 'elementalist-aura' ||
            action.inference === 'elementalist-blinding-flash' ||
            action.inference === 'elementalist-damage-evidence' ||
            action.inference === 'ranger-damage-evidence'
        )
        .map((action) => action.name)
    )
  ];
  if (recoveredReportEvidence.length) {
    warnings.push(`Recovered report evidence: added missing ${recoveredReportEvidence.join(', ')} casts.`);
  }

  if (unsupported.length) {
    warnings.push(
      `Needs review: ${unsupported.length} report action${unsupported.length === 1 ? '' : 's'} could not be matched and ${unsupported.length === 1 ? 'was' : 'were'} preserved as timing waits.`
    );
  }

  if (interrupted.length) {
    warnings.push(
      `Interrupted cast: ${interrupted.length} cast${interrupted.length === 1 ? ' was' : 's were'} kept at the recorded shortened duration.`
    );
  }

  const equippedKits = new Set<string>();
  let missingInitialKit = '';
  let mineArmed = false;
  let missingMineSetup = false;
  for (const action of resolved) {
    if (action.skill?.handlerId === 'engineer.kit-equip') {
      equippedKits.add(normalized(action.skill.kitName || action.name));
    }

    const requiredKit = normalized(action.skill?.kit);
    if (requiredKit && !equippedKits.has(requiredKit) && !missingInitialKit) {
      missingInitialKit = String(action.skill?.kit || '').trim();
    }

    if (normalized(action.name) === 'throw mine') mineArmed = true;
    if (normalized(action.name) === 'detonate') {
      if (!mineArmed) missingMineSetup = true;
      mineArmed = false;
    }
  }

  if (missingInitialKit) {
    warnings.push(`Missing setup: ${missingInitialKit} was required, but its equip action could not be recovered.`);
  }

  if (missingMineSetup) {
    warnings.push('Missing setup: Detonate was present, but the preceding Throw Mine action could not be recovered.');
  }

  return warnings;
}

export function reconstructDpsReportWithProfile(
  report: ParsedDpsReport,
  profile: RotationProfessionProfile,
  catalog: RotationCatalog | null = null,
  options: DpsReportRotationOptions = {}
): DpsReportRotationReconstruction {
  const playerIndex = options.playerIndex ?? detectDpsReportRotationPlayers(report)[0]?.index;
  const player = playerIndex == null ? null : report.players[playerIndex];
  if (!player) {
    throw new DpsReportError('PLAYER_NOT_FOUND', 'The requested player is not present in the Elite Insights report.');
  }

  const detectedProfile = dpsReportRotationProfile(player.profession);
  if (
    detectedProfile?.professionId !== profile.professionId ||
    detectedProfile.specializationId !== profile.specializationId
  ) {
    throw new DpsReportError(
      'UNSUPPORTED_PROFESSION',
      `The ${profile.professionName} ${profile.specializationName} parser cannot parse ${player.profession}.`
    );
  }

  const { phase, index: phaseIndex } = phaseFor(report, options.phaseIndex);
  const recorded = recordedActions(report, player, phase);
  const professionActions = reconstructDpsReportProfessionActions({
    report,
    player,
    phase,
    profile,
    catalog,
    recordedActions: recorded.actions,
    selectedSkillNames: options.selectedSkillNames,
    selectedSkillIds: options.selectedSkillIds,
    professionConfig: options.professionConfig
  });
  const resolved = alignOpeningStrikeCombatStart(
    applyCastInterrupts(
      professionActions
        .map((action) => resolveAction(action, profile, catalog, options.selectedSkillIds))
        .map(applyRetainedCastLockout)
        .sort(compareResolvedActions)
        // Derived packets marked simulatorExcluded are materialized by their parent and must not become replayed inputs.
        .filter((action) => action.skill?.simulatorExcluded !== true)
        // Unsupported Weapon Stow rows are cancellation artifacts, not replayable actions or intentional idle time.
        .filter((action) => action.skill != null || normalized(action.rawName) !== 'weapon stow')
        .filter((action) => autoattackCommitted(report, action))
    ),
    phase.start
  );
  if (!resolved.length) {
    throw new DpsReportError('NO_ROTATION_ACTIONS', 'The selected player has no reconstructable casts in this phase.');
  }

  const combatStart = replayCombatStart(resolved, phase.start) ?? phase.start;
  const origin = Math.min(resolved[0].start, combatStart);
  const actions: DpsReportRotationAction[] = resolved
    .filter((action) => action.control == null)
    .map((action) => ({
      timestampMs: action.start - origin,
      endTimestampMs: action.end - origin,
      durationMs: action.end - action.start,
      expectedDurationMs: action.expectedDurationMs ?? null,
      rawSkillId: action.rawSkillId,
      skillId: action.skillId,
      name: action.name,
      kind: actionKind(action.skill, action.name),
      status: action.status,
      supportedByCatalog: action.skill != null,
      metadataAccurate: action.metadataAccurate,
      inferred: action.inference != null,
      ...(action.doubleEdgeOutcome == null ? {} : { doubleEdgeOutcome: action.doubleEdgeOutcome })
    }));
  return {
    parserId: `${profile.professionId}:${profile.specializationId}`,
    player: {
      index: playerIndex,
      character: player.name,
      account: player.account || '',
      professionId: profile.professionId,
      professionName: profile.professionName,
      specializationId: profile.specializationId,
      specializationName: profile.specializationName,
      recordedActionCount: recordedActionCount(report, player)
    },
    phase: {
      index: phaseIndex,
      name: phase.name,
      start: phase.start,
      end: phase.end
    },
    timelineOriginMs: origin,
    combatStartTimestampMs: combatStart - origin,
    actions,
    rotation: buildRotation(resolved, origin, combatStart, profile.specializationId === 'troubadour'),
    warnings: warningList(actions, resolved)
  };
}
