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

// Core normalization runs for every Warrior, while this table limits each
// specialization's evidence heuristics to logs where those mechanics exist.
const specializationAnalyzers: ReadonlyMap<string, WarriorActionTransform> = new Map([
  ['berserker', reconstructBerserkerActions],
  ['bladesworn', reconstructBladeswornActions],
  ['paragon', reconstructParagonActions],
  ['spellbreaker', reconstructSpellbreakerActions]
]);

/**
 * Runs the Warrior EVTC pipeline in dependency order: normalize shared
 * animations, recover specialization-only actions, then discard inputs that
 * ArcDPS recorded after the encounter target had left combat or died.
 */
export function reconstructWarriorProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions = normalizeWarriorCommonActions(context, context.recordedActions);
  const analyzer = specializationAnalyzers.get(context.profile.specializationId);
  return removePostEncounterWarriorActions(context, analyzer?.(context, actions) || actions);
}
