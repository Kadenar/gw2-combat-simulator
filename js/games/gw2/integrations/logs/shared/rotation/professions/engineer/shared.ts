import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import { quantizeGw2ActionTimingMs, referenceCastTimeMs } from '#gw2/platform/skills/timing.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/shared/rotation/catalog.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

const KIT_SWAP_SIGNAL_WINDOW_MS = 25;
const PHOTON_FORGE_TRANSITION_IDS = new Set([42938, 41123, 45219]);
// Vent Exhaust, Overheat, and the mech's Rocket Punch are generated consequences, not player inputs.
const TRIGGERED_PROC_SKILL_IDS = new Set([43630, 43937, 63185]);

/** Restores old EI Devastator pseudo-casts whose duration was emitted as one 80 ms tick despite a complete cast. */
function restoreLegacyDevastatorCast(
  context: LogActionNormalizationContext,
  action: RecordedLogAction
): RecordedLogAction {
  if (
    action.rawSkillId !== ID.DEVASTATOR ||
    action.status !== 'reduced' ||
    quantizeGw2ActionTimingMs(action.end - action.start) !== 80
  ) {
    return action;
  }

  const castTimeMs = referenceCastTimeMs(recordedActionSkill(action, context));
  if (castTimeMs <= 0 || Number(action.expectedDurationMs) < castTimeMs - 80) return action;
  return { ...action, end: action.start + castTimeMs, status: 'completed', expectedDurationMs: castTimeMs };
}

function kitName(skill: EngineerSkill | null): string | null {
  if (skill?.kitTransition !== 'equip') return null;
  const name = String(skill.kitName || skill.name || '').trim();
  return name || null;
}

function kitStow(
  context: LogActionNormalizationContext,
  kit: string,
  action: RecordedLogAction
): RecordedLogAction | null {
  const skill = context.catalog?.skills.find(
    (candidate) =>
      (candidate as EngineerSkill).kitTransition === 'stow' && normalized(candidate.kit) === normalized(kit)
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
  const kitSwapSignals = context.recordedActions.filter(
    (action) => action.isSwap && normalized(action.rawName) === 'weapon swap'
  );
  const sorted = context.recordedActions
    .map((action) => restoreLegacyDevastatorCast(context, action))
    .map((action) => {
      const equippedKit = kitName(recordedActionSkill(action, context));
      if (!equippedKit) return action;
      // EI derives both rows from one kit transition; snap their millisecond jitter so an outgoing weapon cast wins the tie.
      const signal = kitSwapSignals.find(
        (candidate) => candidate.start >= action.start && candidate.start - action.start <= KIT_SWAP_SIGNAL_WINDOW_MS
      );
      const outgoingCast = signal
        ? context.recordedActions.find((candidate) => {
            const skill = recordedActionSkill(candidate, context);
            return (
              candidate.start === signal.start &&
              normalized(skill?.type) === 'weapon' &&
              normalized(skill?.kit) !== normalized(equippedKit)
            );
          })
        : null;
      return outgoingCast && signal ? { ...action, start: signal.start, end: signal.start } : action;
    })
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const result: RecordedLogAction[] = [];
  const forgeTransitions = sorted.filter((action) => PHOTON_FORGE_TRANSITION_IDS.has(action.rawSkillId));
  let activeKit: string | null = null;
  let lastKitEquip: RecordedLogAction | null = null;

  for (const action of sorted) {
    // EI reports do not always label known trait procs, so reject their fixed IDs before reconstructing player inputs.
    if (TRIGGERED_PROC_SKILL_IDS.has(action.rawSkillId)) continue;
    const skill = recordedActionSkill(action, context);

    // Forge replaces the kit itself, even when the log omits its paired bundle-change signal.
    if (PHOTON_FORGE_TRANSITION_IDS.has(action.rawSkillId)) {
      activeKit = null;
      lastKitEquip = null;
    }

    const equippedKit = kitName(skill);
    if (equippedKit) {
      result.push(action);
      activeKit = equippedKit;
      lastKitEquip = action;
      continue;
    }

    if (action.isSwap && normalized(action.rawName) === 'weapon swap') {
      // Suppress Forge bundle changes before they can become redundant kit stows, including earlier tied signals.
      if (forgeTransitions.some((forge) => Math.abs(action.start - forge.start) <= KIT_SWAP_SIGNAL_WINDOW_MS)) {
        activeKit = null;
        lastKitEquip = null;
        continue;
      }

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
