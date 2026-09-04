import type { Skill } from '#gw2/platform/engine/types.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  catalogSkillById,
  normalizedName as normalized,
  recordedActionSkill
} from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/lib/rotation/rules/composites.js';
import { primaryTargetHits } from '#gw2/integrations/logs/dps-report/rotation/target-damage.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const METAL_LEGION_GUITAR_FINISH_ID = 76_596;
const THOUSAND_NEEDLES_DAMAGE_ID = 56_897;
const PILFER_IDS: ReadonlySet<number> = new Set([ID.SKRITT_SWIPE, ID.SKRITT_SCUFFLE]);
const THOUSAND_NEEDLES_PACKETS = 5;
const CHAK_SHIELD_BASE_PACKETS = 5;
const CHAK_SHIELD_PACKET_INTERVAL_MS = 1_000;
const CANNON_SUCCESS_PACKETS = 3;
const CANNON_BACKFIRE_PACKETS = 1;
const CANNON_SUCCESS_RECAST_MIN_MS = 9_000;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

function selectedSkill(context: DpsReportProfessionReconstructionContext, skill: Skill): boolean {
  return (
    !context.selectedSkillNames?.length ||
    context.selectedSkillNames.some((name) => normalized(name) === normalized(skill.name))
  );
}

/** Places omitted Chak Shield casts where packet counts cross report subphase boundaries. */
function recoverChakShield(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'antiquary' || context.phase.phaseType !== 'Encounter') {
    return [...actions];
  }

  const skill = catalogSkillById(context.catalog, ID.CHAK_SHIELD);
  if (!skill) return [...actions];
  const selectedTraits = new Set(
    Array.isArray(context.professionConfig?.selectedTraitIds)
      ? context.professionConfig.selectedTraitIds.map(Number)
      : []
  );
  const packetsPerCast = CHAK_SHIELD_BASE_PACKETS + Number(selectedTraits.has(TRAIT.METICULOUS_CUSTODIAN));
  const recorded = actions.filter((action) => (action.canonicalSkillId ?? action.rawSkillId) === ID.CHAK_SHIELD).length;
  let missing = primaryTargetHits(context, ID.CHAK_SHIELD) / packetsPerCast - recorded;
  if (!Number.isInteger(missing) || missing <= 0) return [...actions];

  const encounterIndex = context.report.phases.indexOf(context.phase);
  const subphases = context.report.phases
    .filter((phase) => phase.encounterPhase === encounterIndex && phase.phaseType === 'SubPhase')
    .sort((left, right) => left.start - right.start);
  const inferred: DpsReportRecordedAction[] = [];
  let pendingPackets = 0;
  for (const phase of subphases) {
    let phasePackets = primaryTargetHits(context, ID.CHAK_SHIELD, phase);
    let packetsBeforeBoundary = pendingPackets;
    while (phasePackets > 0 && missing > 0) {
      const consumed = Math.min(packetsPerCast - pendingPackets, phasePackets);
      pendingPackets += consumed;
      phasePackets -= consumed;
      if (pendingPackets !== packetsPerCast) continue;
      if (packetsBeforeBoundary > 0) {
        const at = phase.start - (packetsBeforeBoundary - 0.5) * CHAK_SHIELD_PACKET_INTERVAL_MS;
        inferred.push(inferredAction(skill, at, at, phase.start - 0.1, 'thief-damage-evidence'));
        missing -= 1;
      }

      pendingPackets = 0;
      packetsBeforeBoundary = 0;
    }
  }

  return [...actions, ...inferred].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

function inferredAction(
  skill: Skill,
  start: number,
  end: number,
  eventIndex: number,
  inference: NonNullable<DpsReportRecordedAction['inference']>
): DpsReportRecordedAction {
  return {
    start,
    end,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    status: end > start ? 'completed' : 'instant',
    eventIndex,
    isSwap: false,
    metadataAccurate: false,
    inference,
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
}

/** Collapses Elite Insights' Rockout/Smash rows into the one Guitar input that produced both animations. */
function mergeMetalLegionGuitar(actions: readonly DpsReportRecordedAction[]): DpsReportRecordedAction[] {
  return mergeCompositeActions(
    actions,
    [
      {
        startId: ID.METAL_LEGION_GUITAR,
        finishId: METAL_LEGION_GUITAR_FINISH_ID,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS,
        dropUnmatchedFinish: true
      }
    ],
    (action, finish) => ({
      ...action,
      end: Math.max(action.end, finish.end),
      status: mergedActionStatus(action.status, finish.status),
      metadataAccurate: action.metadataAccurate && finish.metadataAccurate,
      expectedDurationMs:
        Number(action.expectedDurationMs || action.end - action.start) +
        Number(finish.expectedDurationMs || finish.end - finish.start),
      canonicalSkillId: ID.METAL_LEGION_GUITAR,
      canonicalName: 'Metal Legion Guitar'
    })
  );
}

/** Restores an omitted opening Swipe only when a later artifact proves that Antiquary had already pilfered. */
function recoverOpeningSkrittSwipe(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'antiquary') return [...actions];
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const artifact = sorted.find((action) => recordedActionSkill(action, context)?.handlerId === 'thief.artifact');
  const recordedPilfer = sorted.find((action) => PILFER_IDS.has(action.canonicalSkillId ?? action.rawSkillId));
  const skill = catalogSkillById(context.catalog, ID.SKRITT_SWIPE);
  if (!artifact || !skill || (recordedPilfer && recordedPilfer.start < artifact.start)) return sorted;

  const anchor = sorted[0];
  const firstAware = Number(context.player.firstAware);
  const observedDuration = median(
    context.player.rotation
      .find((group) => group.id === ID.SKRITT_SWIPE)
      ?.skills.map((cast) => cast.duration)
      .filter((duration) => duration > 0) || []
  );
  const start = Math.max(
    Number.isFinite(firstAware) ? firstAware : Number.NEGATIVE_INFINITY,
    anchor.start - observedDuration
  );
  const inferred = {
    ...inferredAction(skill, start, start, Math.min(-1, anchor.eventIndex - 1), 'thief-opening'),
    ...(Number.isFinite(firstAware) ? { combatStartOverride: firstAware } : {})
  };
  return [inferred, ...sorted].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}

/** Restores a truncated opening Caltrops when its first visible recast matches the active cooldown cycle. */
function recoverOpeningCaltrops(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const skill = catalogSkillById(context.catalog, ID.CALTROPS);
  const swipe = actions.find(
    (action) => action.inference === 'thief-opening' && action.canonicalSkillId === ID.SKRITT_SWIPE
  );
  const firstRecorded = actions.find(
    (action) => action.inference == null && (action.canonicalSkillId ?? action.rawSkillId) === ID.CALTROPS
  );
  if (!skill || !swipe || !firstRecorded || !selectedSkill(context, skill)) return [...actions];

  const duration = median(
    context.player.rotation
      .find((group) => group.id === ID.CALTROPS)
      ?.skills.map((cast) => cast.duration)
      .filter((value) => value > 0) || []
  );
  const alacrity = (context.professionConfig?.boons as { readonly alacrity?: boolean } | undefined)?.alacrity === true;
  const recharge = (Number(skill.cooldown || 0) * 1000) / (alacrity ? 1.25 : 1);
  const recastGap = firstRecorded.start - swipe.start;
  if (!(duration > 0) || recastGap < recharge || recastGap > recharge + duration + 500) return [...actions];

  const inferred = inferredAction(skill, swipe.start - duration, swipe.start, swipe.eventIndex - 0.1, 'thief-opening');
  return [...actions, inferred].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}

/** Uses five-packet damage totals to recover Needles activations omitted from EI's instant-cast list. */
function recoverThousandNeedles(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const prepareSkill = catalogSkillById(context.catalog, ID.PREPARE_THOUSAND_NEEDLES);
  const activationSkill = catalogSkillById(context.catalog, ID.THOUSAND_NEEDLES);
  const totalPackets = primaryTargetHits(context, THOUSAND_NEEDLES_DAMAGE_ID);
  if (
    !prepareSkill ||
    !activationSkill ||
    !selectedSkill(context, prepareSkill) ||
    totalPackets <= 0 ||
    totalPackets % THOUSAND_NEEDLES_PACKETS !== 0
  ) {
    return [...actions];
  }

  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const prepares = sorted.filter(
    (action) => (action.canonicalSkillId ?? action.rawSkillId) === ID.PREPARE_THOUSAND_NEEDLES
  );
  const activations = sorted.filter((action) => (action.canonicalSkillId ?? action.rawSkillId) === ID.THOUSAND_NEEDLES);
  let missing = totalPackets / THOUSAND_NEEDLES_PACKETS - activations.length;
  if (missing <= 0) return sorted;

  const matches = prepares.map((prepare, index) => {
    const nextPrepare = prepares[index + 1];
    return activations.find(
      (activation) =>
        activation.start >= prepare.end - COMPOSITE_SIGNAL_WINDOW_MS &&
        activation.start < (nextPrepare?.start ?? Number.POSITIVE_INFINITY)
    );
  });
  const delay = median(
    matches.flatMap((activation, index) => (activation ? [activation.start - prepares[index].end] : []))
  );
  const inferred: DpsReportRecordedAction[] = [];
  for (let index = 0; index < prepares.length && missing > 0; index += 1) {
    if (matches[index]) continue;
    const at = prepares[index].end + delay;
    if (!(delay > 0) || at >= context.phase.end) continue;
    inferred.push(inferredAction(activationSkill, at, at, prepares[index].eventIndex + 0.1, 'thief-damage-evidence'));
    missing -= 1;
  }

  const firstAware = Number(context.player.firstAware);
  const cooldownMs = Math.max(0, Number(prepareSkill.cooldown || 0) * 1000);
  const durationMs = Math.max(0, Number(prepareSkill.castTimeMs || 0));
  if (missing === 1 && context.phase.phaseType === 'Encounter' && Number.isFinite(firstAware) && cooldownMs > 0) {
    const start = firstAware - cooldownMs - durationMs;
    inferred.push(
      inferredAction(prepareSkill, start, start + durationMs, -3, 'thief-opening'),
      inferredAction(activationSkill, context.phase.start, context.phase.start, -2, 'thief-damage-evidence')
    );
  }

  return [...sorted, ...inferred].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}

/** Replays Cannon and Coin Toss outcomes only when report damage or the sustained resource pattern proves them. */
function normalizeAntiquaryDoubleEdge(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'antiquary') return [...actions];
  const cannons = actions
    .filter((action) => (action.canonicalSkillId ?? action.rawSkillId) === ID.STONE_SUMMIT_CANNON)
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const cannonOutcomes = new Map<DpsReportRecordedAction, 'success' | 'backfire'>();
  for (let index = 0; index < cannons.length; index += 1) {
    cannonOutcomes.set(
      cannons[index],
      index === 0 || cannons[index].start - cannons[index - 1].start >= CANNON_SUCCESS_RECAST_MIN_MS
        ? 'success'
        : 'backfire'
    );
  }

  const expectedCannonHits = [...cannonOutcomes.values()].reduce(
    (total, outcome) => total + (outcome === 'success' ? CANNON_SUCCESS_PACKETS : CANNON_BACKFIRE_PACKETS),
    0
  );
  const observedCannonHits = primaryTargetHits(context, ID.STONE_SUMMIT_CANNON);
  const cannonEvidenceMatches =
    observedCannonHits === expectedCannonHits || observedCannonHits === expectedCannonHits + CANNON_BACKFIRE_PACKETS;

  const flawlessCount = actions.filter(
    (action) => (action.canonicalSkillId ?? action.rawSkillId) === ID.FLAWLESS_EXECUTION
  ).length;
  const coinTosses = actions
    .filter((action) => (action.canonicalSkillId ?? action.rawSkillId) === ID.CANACH_COIN_TOSS_ID_77230)
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const coinOutcomes = new Map<DpsReportRecordedAction, 'success' | 'backfire'>(
    flawlessCount >= 30 ? coinTosses.map((action, index) => [action, index === 0 ? 'success' : 'backfire']) : []
  );
  const normalized = actions.map((action) => {
    const outcome = (cannonEvidenceMatches ? cannonOutcomes.get(action) : null) || coinOutcomes.get(action);
    return outcome ? { ...action, doubleEdgeOutcome: outcome } : action;
  });

  const cannonSkill = catalogSkillById(context.catalog, ID.STONE_SUMMIT_CANNON);
  if (
    cannonSkill &&
    cannonEvidenceMatches &&
    observedCannonHits === expectedCannonHits + CANNON_BACKFIRE_PACKETS &&
    cannons[0]
  ) {
    normalized.push({
      ...inferredAction(cannonSkill, cannons[0].end, cannons[0].end, cannons[0].eventIndex + 0.1, 'thief-double-edge'),
      replayInterruptMs: 0,
      doubleEdgeOutcome: 'backfire'
    });
  }

  return normalized.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}

/** Applies Thief-only recovery while keeping every inference tied to report evidence. */
export function reconstructThiefDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  let actions = mergeMetalLegionGuitar(context.recordedActions);
  actions = recoverOpeningSkrittSwipe(context, actions);
  actions = recoverOpeningCaltrops(context, actions);
  actions = recoverThousandNeedles(context, actions);
  actions = recoverChakShield(context, actions);
  return normalizeAntiquaryDoubleEdge(context, actions);
}
