import { committedActionsFromStrikePackets } from '../../effect-packets.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { normalized, skillForAction } from './shared.js';

const MAX_AUTOATTACK_IMPACT_MS = 2000;

function isAutoattack(context: EvtcProfessionReconstructionContext, action: EvtcRecordedRotationAction): boolean {
  return normalized(skillForAction(context, action)?.slot) === 'weapon_1';
}

export function removeUncommittedEngineerAutoattacks(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const autoattacks = actions.filter((action) => isAutoattack(context, action));
  const committed = committedActionsFromStrikePackets(context, autoattacks, {
    maxFallbackImpactMs: MAX_AUTOATTACK_IMPACT_MS
  });
  return actions.filter((action) => !isAutoattack(context, action) || committed.has(action));
}
