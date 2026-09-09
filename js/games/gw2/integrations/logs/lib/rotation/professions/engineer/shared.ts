import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const KIT_SWAP_SIGNAL_WINDOW_MS = 25;
// EI can list Vent Exhaust and the mech's triggered Rocket Punch as casts; the simulator already generates them.
const TRIGGERED_PROC_SKILL_IDS = new Set([43630, 63185]);

function kitName(skill: Skill | null): string | null {
  if (skill?.handlerId !== 'engineer.kit-equip') return null;
  const name = String(skill.kitName || skill.name || '').trim();
  return name || null;
}

function kitStow(
  context: LogActionNormalizationContext,
  kit: string,
  action: RecordedLogAction
): RecordedLogAction | null {
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

/** Converts represented kit swaps and mine detonations without inserting missing preparation. */
export function reconstructEngineerDependencies(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const result: RecordedLogAction[] = [];
  let activeKit: string | null = null;
  let lastKitEquip: RecordedLogAction | null = null;

  for (const action of sorted) {
    // EI reports do not always label known trait procs, so reject their fixed IDs before reconstructing player inputs.
    if (TRIGGERED_PROC_SKILL_IDS.has(action.rawSkillId)) continue;
    const skill = recordedActionSkill(action, context);

    const equippedKit = kitName(skill);
    if (equippedKit) {
      result.push(action);
      activeKit = equippedKit;
      lastKitEquip = action;
      continue;
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
      result.push(action.rawSkillId < 0 ? { ...action, canonicalSkillId: 6162, canonicalName: 'Detonate' } : action);
      continue;
    }

    result.push(action);
    lastKitEquip = null;
  }

  return result.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
