import { reconstructBerserkerActions } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/berserker.js';
import { reconstructBladeswornActions } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/bladesworn.js';
import {
  normalizeWarriorCommonActions,
  removePostEncounterWarriorActions
} from '#gw2/integrations/logs/evtc/rotation/professions/warrior/common.js';
import { reconstructParagonActions } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/paragon.js';
import { reconstructSpellbreakerActions } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/spellbreaker.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

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
