import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { recordedActionSkill } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

const BUNDLE_SET = 2;
const SIGNAL_WINDOW_MS = 5;

/** Decode confirmed Cyclone Bow bar changes as form inputs, preserving actual equipped-weapon swaps. */
export function galeshotCycloneBowActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'galeshot') return context.recordedActions;

  const actions = [...context.recordedActions].sort((a, b) => a.start - b.start || a.eventIndex - b.eventIndex);
  const bowSkill = (action: EvtcRecordedRotationAction) =>
    (recordedActionSkill(action, context) as RangerSkill | undefined)?.cycloneBowSkill === true;
  const swaps = actions.filter((action) => action.weaponSet != null);
  const transition = (action: EvtcRecordedRotationAction, skillId: number): EvtcRecordedRotationAction => ({
    ...action,
    rawSkillId: skillId,
    rawName: skillId === ID.SUMMON_CYCLONE_BOW ? 'Summon Cyclone Bow' : 'Dismiss Cyclone Bow',
    weaponSet: undefined,
    isSwap: false
  });
  const firstBow = actions.find(bowSkill);
  const firstTransition = actions.find(
    (action) => action.weaponSet != null || action.rawSkillId === ID.SUMMON_CYCLONE_BOW
  );
  // A log may begin inside the form. Restore the required state at its first proven use, not an invented earlier cast.
  const startsInBow = firstBow != null && (!firstTransition || firstBow.start < firstTransition.start);
  const result: EvtcRecordedRotationAction[] = startsInBow
    ? [
        transition(
          {
            start: firstBow.start,
            end: firstBow.start,
            expectedDurationMs: 0,
            rawSkillId: ID.SUMMON_CYCLONE_BOW,
            rawName: 'Summon Cyclone Bow',
            status: 'instant',
            evidence: 'synthesized',
            metadataAccurate: false,
            eventIndex: firstBow.eventIndex - 1
          },
          ID.SUMMON_CYCLONE_BOW
        )
      ]
    : [];
  let inBow = startsInBow;
  for (const action of actions) {
    if (action.rawSkillId === ID.SUMMON_CYCLONE_BOW) inBow = true;

    if (action.rawSkillId === ID.DISMISS_CYCLONE_BOW) inBow = false;

    if (action.weaponSet == null) {
      result.push(action);
      continue;
    }

    const nextSwap = swaps.find((swap) => swap.start > action.start);
    // Set 2 is shared by bundles. A bow skill or an explicit dismissal must corroborate this particular interval.
    const entersBow =
      action.weaponSet === BUNDLE_SET &&
      actions.some(
        (candidate) =>
          candidate.start >= action.start &&
          candidate.start <= (nextSwap?.start ?? Infinity) &&
          (bowSkill(candidate) || candidate.rawSkillId === ID.DISMISS_CYCLONE_BOW)
      );
    const explicitId = entersBow ? ID.SUMMON_CYCLONE_BOW : ID.DISMISS_CYCLONE_BOW;
    const existing = actions.some(
      (candidate) => candidate.rawSkillId === explicitId && Math.abs(candidate.start - action.start) <= SIGNAL_WINDOW_MS
    );

    if (entersBow || (action.weaponSet !== BUNDLE_SET && (inBow || existing))) {
      // Effect and bar-change records describe one input; never emit a second transition or an equipment swap.
      if (!existing) result.push(transition(action, explicitId));

      inBow = entersBow;
    } else result.push(action);
  }

  return result.sort((a, b) => a.start - b.start || a.eventIndex - b.eventIndex);
}
