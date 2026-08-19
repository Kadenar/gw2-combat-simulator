import { findRotationSkill } from '../../catalog.js';
import { committedActionsFromStrikePackets } from '../../effect-packets.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

const MAX_AUTOATTACK_IMPACT_MS = 2000;

function isAutoattack(context: EvtcProfessionReconstructionContext, action: EvtcRecordedRotationAction): boolean {
  const skill = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
  );
  return String(skill?.slot || '').toLowerCase() === 'weapon_1';
}

function requiresDamageEvidence(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): boolean {
  const name = String(action.canonicalName || action.rawName).toLowerCase();
  return (
    action.status === 'interrupted' ||
    name === 'spatial surge' ||
    (context.profile.specializationId === 'virtuoso' && name === 'flying cutter')
  );
}

export function removeUncommittedMesmerAutoattacks(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const autoattacks = actions.filter((action) => isAutoattack(context, action));
  const committed = committedActionsFromStrikePackets(context, autoattacks, {
    maxFallbackImpactMs: MAX_AUTOATTACK_IMPACT_MS
  });
  return actions.filter((action) => {
    if (!isAutoattack(context, action)) return true;
    if (
      action.status === 'interrupted' &&
      String(action.canonicalName || action.rawName).toLowerCase() === 'winds of chaos'
    ) {
      return false;
    }

    return !requiresDamageEvidence(context, action) || committed.has(action);
  });
}
