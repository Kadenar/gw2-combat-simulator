import type { Skill } from '#gw2/platform/engine/types.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { createInferredAction } from '#gw2/integrations/logs/dps-report/rotation/create-inferred-action.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const KIT_SWAP_SIGNAL_WINDOW_MS = 25;
const MINE_SETUP_WAIT_MS = 5000;
const TRIGGERED_PROC_SKILL_IDS = new Set([43630]);

function kitName(skill: Skill | null): string | null {
  if (skill?.handlerId !== 'engineer.kit-equip') return null;
  const name = String(skill.kitName || skill.name || '').trim();
  return name || null;
}

/** Rejects inaccurate EI toolbelt rows whose parent skill is absent from the active build. */
function unavailableToolbeltAction(skill: Skill | null, context: DpsReportProfessionReconstructionContext): boolean {
  const parentName = normalized(skill?.toolbeltParentName);
  if (!parentName || !context.selectedSkillNames?.length) return false;
  return !context.selectedSkillNames.some((name) => normalized(name) === parentName);
}

function kitEquip(
  context: DpsReportProfessionReconstructionContext,
  kit: string,
  action: DpsReportRecordedAction
): DpsReportRecordedAction | null {
  const skill = context.catalog?.skills.find(
    (candidate) =>
      candidate.handlerId === 'engineer.kit-equip' &&
      normalized(candidate.kitName || candidate.name) === normalized(kit)
  );
  if (!skill || typeof skill.id !== 'number') return null;
  return createInferredAction(skill, action.start, action.start, action.eventIndex - 0.25, 'initial-kit');
}

function kitStow(
  context: DpsReportProfessionReconstructionContext,
  kit: string,
  action: DpsReportRecordedAction
): DpsReportRecordedAction | null {
  const skill = context.catalog?.skills.find(
    (candidate) => candidate.handlerId === 'engineer.kit-stow' && normalized(candidate.kit) === normalized(kit)
  );
  if (!skill || typeof skill.id !== 'number') return null;
  return {
    ...action,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
}

function inferredMineSetup(
  context: DpsReportProfessionReconstructionContext,
  detonate: DpsReportRecordedAction,
  firstActionStart: number
): DpsReportRecordedAction | null {
  const skill = context.catalog?.skills.find((candidate) => normalized(candidate.name) === 'throw mine');
  if (!skill || typeof skill.id !== 'number') return null;
  const duration = Math.max(0, Number(skill.quicknessCastTimeMs || skill.castTimeMs || 0));
  return {
    ...createInferredAction(
      skill,
      firstActionStart - duration,
      firstActionStart,
      detonate.eventIndex - 0.5,
      'mine-setup'
    ),
    followingWaitMs: MINE_SETUP_WAIT_MS
  };
}

/** Rebuilds deterministic Engineer kit and mine dependencies omitted by EI summaries. */
export function reconstructEngineerDependencies(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const result: DpsReportRecordedAction[] = [];
  let activeKit: string | null = null;
  let lastKitEquip: DpsReportRecordedAction | null = null;
  let mineArmed = false;
  let inferredOpeningMine = false;

  for (const action of sorted) {
    // EI reports do not always label known trait procs, so reject their fixed IDs before reconstructing player inputs.
    if (TRIGGERED_PROC_SKILL_IDS.has(action.rawSkillId)) continue;
    const skill = recordedActionSkill(action, context);
    if (unavailableToolbeltAction(skill, context)) continue;
    const equippedKit = kitName(skill);
    if (equippedKit) {
      result.push(action);
      activeKit = equippedKit;
      lastKitEquip = action;
      continue;
    }

    const requiredKit = String(skill?.kit || '').trim();
    if (requiredKit && normalized(activeKit) !== normalized(requiredKit)) {
      const equip = kitEquip(context, requiredKit, action);
      if (equip) {
        result.push(equip);
        activeKit = requiredKit;
        lastKitEquip = equip;
      }
    } else if (activeKit && !requiredKit && normalized(skill?.type) === 'weapon') {
      const stow = kitStow(context, activeKit, {
        ...action,
        start: action.start,
        end: action.start,
        status: 'instant',
        eventIndex: action.eventIndex - 0.25,
        metadataAccurate: false,
        inference: 'initial-kit'
      });
      if (stow) result.push(stow);
      activeKit = null;
      lastKitEquip = null;
    }

    if (action.isSwap && normalized(action.rawName) === 'weapon swap') {
      if (lastKitEquip && action.start - lastKitEquip.start <= KIT_SWAP_SIGNAL_WINDOW_MS) {
        lastKitEquip = null;
        continue;
      }

      if (activeKit) {
        const stow = kitStow(context, activeKit, action);
        if (stow) result.push(stow);
        activeKit = null;
        lastKitEquip = null;
        continue;
      }
    }

    const actionName = normalized(skill?.name || action.canonicalName || action.rawName);
    const isMineDetonation =
      actionName === 'detonate' ||
      (action.rawSkillId < 0 && normalized(action.rawName).startsWith('detonate (throw mine'));
    if (isMineDetonation) {
      if (!mineArmed && !inferredOpeningMine) {
        const setup = inferredMineSetup(context, action, sorted[0]?.start ?? action.start);
        if (setup) {
          result.push(setup);
          inferredOpeningMine = true;
        }
      }

      result.push(action.rawSkillId < 0 ? { ...action, canonicalSkillId: 6162, canonicalName: 'Detonate' } : action);
      mineArmed = false;
      continue;
    }

    result.push(action);
    if (actionName === 'throw mine') mineArmed = true;
    lastKitEquip = null;
  }

  return result.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
