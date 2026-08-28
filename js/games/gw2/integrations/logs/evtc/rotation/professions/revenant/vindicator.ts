import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { committedActionsFromStrikePackets, skillForAction } from '../../effect-packets.js';
import { reconstructCommonRevenantActions } from './common.js';

const DEATH_DROP_IDS = new Set([62693, 62730]);

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function deathDrop(action: EvtcRecordedRotationAction): boolean {
  return (
    DEATH_DROP_IDS.has(Number(action.rawSkillId)) ||
    DEATH_DROP_IDS.has(Number(action.canonicalSkillId)) ||
    normalized(action.rawName) === 'death drop' ||
    normalized(action.canonicalName) === 'death drop'
  );
}

function dodge(action: EvtcRecordedRotationAction, context: EvtcProfessionReconstructionContext): boolean {
  return (
    action.rawSkillId === 23275 ||
    Number(action.canonicalSkillId) === Number(context.profile.dodge.skillId) ||
    normalized(action.rawName) === normalized(context.profile.dodge.name) ||
    normalized(action.canonicalName) === normalized(context.profile.dodge.name)
  );
}

/** Replays Death Drop as Dodge and omits canceled autoattack attempts that never produced damage. */
export function reconstructVindicatorActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions = reconstructCommonRevenantActions(context);
  const committedStrikes = committedActionsFromStrikePackets(context, actions);
  const hasDeathDrop = actions.some(deathDrop);

  return actions.flatMap((action) => {
    if (
      action.status === 'interrupted' &&
      normalized(skillForAction(context, action)?.slot) === 'weapon_1' &&
      !committedStrikes.has(action)
    ) {
      return [];
    }

    if (!hasDeathDrop) return [action];
    if (dodge(action, context)) return [];
    return deathDrop(action)
      ? [
          {
            ...action,
            canonicalSkillId: Number(context.profile.dodge.skillId),
            canonicalName: context.profile.dodge.name
          }
        ]
      : [action];
  });
}
