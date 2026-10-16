import { alignConduitHazeCombatOffset } from '#gw2/integrations/logs/shared/rotation/rules/conduit.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/** Account for the unrecorded launch in the opening combat offset without adding a cast. */
export function restoreConduitHazeOpener(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  combatStart: number | null
): readonly EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'conduit' || combatStart == null) return actions;

  const firstAnimation = context.recordedActions.find(
    (action) => action.evidence === 'animation' || action.evidence === 'legacy-activation'
  );

  if (!firstAnimation || firstAnimation.rawSkillId !== 77047) return actions;

  const opener = actions.find((action) => action.rawSkillId === 77047 && action.start === firstAnimation.start);

  if (!opener || opener.start >= combatStart || opener.end < combatStart) return actions;

  const opensCombat = context.log.events.some(
    (event) =>
      event.time === combatStart &&
      event.source === context.playerAddress &&
      event.target !== context.playerAddress &&
      event.skillId === 77047 &&
      event.stateChange === 0 &&
      event.buff === 0 &&
      event.value > 0
  );
  return opensCombat ? alignConduitHazeCombatOffset(actions, context.catalog, combatStart) : actions;
}
