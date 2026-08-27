import type { Skill } from '../../../../../platform/engine/types.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

const JURISDICTION_ID = 71817;
const FIRE_JURISDICTION_ID = 71818;
const RUSHING_JUSTICE_ID = 62668;
const RUSHING_JUSTICE_IMPACT_ID = 62624;
const JURISDICTION_COMBAT_OFFSET_MS = 640;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

function numericSkillId(action: DpsReportRecordedAction): number {
  return Number(action.canonicalSkillId ?? action.rawSkillId);
}

function catalogSkill(context: DpsReportProfessionReconstructionContext, id: number): Skill | null {
  return context.catalog?.skills.find((skill) => typeof skill.id === 'number' && Number(skill.id) === id) || null;
}

function inferredOpeningJurisdiction(
  context: DpsReportProfessionReconstructionContext,
  signal: DpsReportRecordedAction
): DpsReportRecordedAction | null {
  const skill = catalogSkill(context, JURISDICTION_ID);

  if (!skill || typeof skill.id !== 'number') return null;
  const duration = Math.max(0, Number(skill.quicknessCastTimeMs || skill.castTimeMs || 0));
  const start = context.phase.start - JURISDICTION_COMBAT_OFFSET_MS;
  return {
    start,
    end: start + duration,
    rawSkillId: JURISDICTION_ID,
    rawName: skill.name,
    status: 'completed',
    eventIndex: signal.eventIndex,
    isSwap: false,
    metadataAccurate: false,
    expectedDurationMs: duration,
    inference: 'willbender-jurisdiction',
    canonicalSkillId: JURISDICTION_ID,
    canonicalName: skill.name
  };
}

/** Collapses Willbender's EI child animations and recovers the Jurisdiction precast that produced an opening fireball. */
export function reconstructWillbenderDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const consumed = new Set<DpsReportRecordedAction>();
  const normalized: DpsReportRecordedAction[] = [];
  const openingFire = sorted.find(
    (action) => numericSkillId(action) === FIRE_JURISDICTION_ID && action.start < context.phase.start
  );
  const recordedOpeningRoot = sorted.some(
    (action) => numericSkillId(action) === JURISDICTION_ID && action.start < context.phase.start
  );
  const recoveredOpening =
    openingFire && !recordedOpeningRoot ? inferredOpeningJurisdiction(context, openingFire) : null;

  if (recoveredOpening) normalized.push(recoveredOpening);

  for (const action of sorted) {
    if (consumed.has(action) || numericSkillId(action) === FIRE_JURISDICTION_ID) continue;

    if (numericSkillId(action) !== RUSHING_JUSTICE_ID) {
      normalized.push(action);
      continue;
    }

    const impact = sorted.find(
      (candidate) =>
        !consumed.has(candidate) &&
        numericSkillId(candidate) === RUSHING_JUSTICE_IMPACT_ID &&
        candidate.start >= action.start &&
        candidate.start - action.end <= COMPOSITE_SIGNAL_WINDOW_MS
    );

    if (!impact) {
      normalized.push(action);
      continue;
    }

    consumed.add(impact);
    normalized.push({
      ...action,
      end: Math.max(action.end, impact.end),
      expectedDurationMs: Math.max(Number(action.expectedDurationMs || 0), Number(impact.expectedDurationMs || 0)),
      status: impact.status,
      canonicalSkillId: RUSHING_JUSTICE_ID,
      canonicalName: 'Rushing Justice'
    });
  }

  return normalized.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
