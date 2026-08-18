import { reconstructBerserkerActions } from './warrior/berserker.js';
import { reconstructBladeswornActions } from './warrior/bladesworn.js';
import { normalizeWarriorCommonActions, removePostEncounterWarriorActions } from './warrior/common.js';
import { reconstructParagonActions } from './warrior/paragon.js';
import { reconstructSpellbreakerActions } from './warrior/spellbreaker.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from './types.js';

type WarriorActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

const specializationAnalyzers: ReadonlyMap<string, WarriorActionTransform> = new Map([
  ['berserker', reconstructBerserkerActions],
  ['bladesworn', reconstructBladeswornActions],
  ['paragon', reconstructParagonActions],
  ['spellbreaker', reconstructSpellbreakerActions]
]);

export function reconstructWarriorProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions = normalizeWarriorCommonActions(context, context.recordedActions);
  const analyzer = specializationAnalyzers.get(context.profile.specializationId);
  return removePostEncounterWarriorActions(context, analyzer?.(context, actions) || actions);
}
