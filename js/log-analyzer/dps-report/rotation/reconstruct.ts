import { actionKind, findNamedRotationSkill, findRotationSkill, skillIdentity } from '../../lib/rotation/catalog.js';
import type { RotationCatalog } from '../../lib/rotation/catalog.js';
import type {
  ReconstructedCommand,
  ReconstructedRotationCommand,
  RotationActionStatus
} from '../../lib/rotation/model.js';
import type { RotationProfessionProfile } from '../../lib/rotation/profiles.js';
import { buildReplayTimeline } from '../../lib/rotation/timeline.js';
import { firstStrikePacketOffsetMs } from '../../lib/rotation/timing.js';
import type { Skill } from '../../../platform/engine/types.js';
import { observedCommittedInterruptMs, quicknessReferenceCastTimeMs } from '../../../platform/gw2/skills/timing.js';
import { DpsReportError } from '../errors.js';
import type {
  DpsReportCast,
  DpsReportPhase,
  DpsReportPlayer,
  DpsReportRotationAction,
  DpsReportRotationPlayer,
  DpsReportRotationReconstruction,
  DpsReportSkillMetadata,
  ParsedDpsReport
} from '../types.js';
import { dpsReportRotationProfile } from './profiles.js';
import { reconstructDpsReportProfessionActions } from './professions/index.js';
import type { DpsReportRecordedAction, DpsReportResolvedAction, DpsReportRotationOptions } from './types.js';

const TIMING_TOLERANCE_MS = 50;
const DUPLICATE_SIGNAL_WINDOW_MS = 75;
// An autoattack lands its strike near the end of its cast. Elite Insights reports
// each cast's observed duration alongside the nominal length it would have run
// (duration + timeGained); a completed autoattack covers ~0.82 of that nominal
// length before its strike commits. A cast that stopped well short of the strike
// was cancelled and must not enter the rotation — an emitted phantom autoattack
// would wrongly advance the weapon-1 chain and desync every following chain skill.
const AUTOATTACK_COMMIT_FRACTION = 0.7;

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

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
  const resolvedName = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    catalog,
    profile
  )?.name;
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
  const skill =
    selected ||
    findRotationSkill(
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

/** Returns a safe, action-tick-aligned observed duration only when the skill declares its commit contract. */
function observedInterruptMs(action: DpsReportResolvedAction): number | null {
  return observedCommittedInterruptMs(action.skill, action.end - action.start);
}

function actionCommand(action: DpsReportResolvedAction): ReconstructedRotationCommand {
  const command: {
    name: string;
    skillId: string | number;
    offset?: number;
    interruptMs?: number;
  } = { name: action.name, skillId: action.skillId };
  const interruptMs = observedInterruptMs(action);
  // EI's observed cast duration is authoritative only when catalog metadata
  // proves that replaying it will not cancel the skill before it commits.
  if (interruptMs != null) command.interruptMs = interruptMs;

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

/** Keeps only autoattacks with report evidence that their first packet committed. */
function autoattackCommitted(report: ParsedDpsReport, action: DpsReportResolvedAction): boolean {
  if (skillMetadata(report, action.rawSkillId)?.autoAttack !== true) return true;
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

function buildRotation(
  actions: readonly DpsReportResolvedAction[],
  origin: number,
  combatStart: number
): ReconstructedCommand[] {
  return buildReplayTimeline(actions, origin, combatStart, {
    commandFor: actionCommand,
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
          (action) => action.inference === 'elementalist-aura' || action.inference === 'elementalist-blinding-flash'
        )
        .map((action) => action.name)
    )
  ];
  if (recoveredReportEvidence.length) {
    warnings.push(
      `Recovered report evidence: added missing ${recoveredReportEvidence.join(', ')} casts from buff and condition transitions.`
    );
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
  const resolved = professionActions
    .map((action) => resolveAction(action, profile, catalog, options.selectedSkillIds))
    .map(applyRetainedCastLockout)
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)
    .filter((action) => autoattackCommitted(report, action));
  if (!resolved.length) {
    throw new DpsReportError('NO_ROTATION_ACTIONS', 'The selected player has no reconstructable casts in this phase.');
  }

  const origin = Math.min(resolved[0].start, phase.start);
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
      inferred: action.inference != null
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
    combatStartTimestampMs: phase.start - origin,
    actions,
    rotation: buildRotation(resolved, origin, phase.start),
    warnings: warningList(actions, resolved)
  };
}
