import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  MESMER_EFFECT_GUIDS,
  buffGainSignals,
  canonicalAction,
  clusterSignals,
  directSkillSignals,
  effectSignals,
  hasNearbyAction,
  type MesmerActionIdentity,
  type MesmerSignal
} from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/shared.js';

const BLADETURN_REQUIEM = Object.freeze({
  name: 'Bladeturn Requiem',
  skillId: 62597
});
const THOUSAND_CUTS = Object.freeze({
  name: 'Thousand Cuts',
  skillId: 24755
});
const DISTORTION = Object.freeze({ name: 'Distortion', skillId: 68273 });

const DISTORTION_BUFF = 10243;

/**
 * Reconstructs a Virtuoso action from effect-GUID evidence and supplements it with clustered direct packets only when
 * no effect signal appears within the broad correlation window.
 */
function effectBackedActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  identity: MesmerActionIdentity,
  effectGuid: string,
  directSkillId: number,
  directGapMs: number
): EvtcRecordedRotationAction[] {
  const effects = effectSignals(context, effectGuid);
  const signals: MesmerSignal[] = [...effects];
  for (const signal of clusterSignals(directSkillSignals(context, new Set([directSkillId])), directGapMs)) {
    if (!effects.some((effect) => Math.abs(effect.event.time - signal.event.time) <= 2000)) {
      signals.push(signal);
    }
  }

  return signals.flatMap((signal) =>
    hasNearbyAction(actions, identity, signal.event.time, 100)
      ? []
      : [canonicalAction(signal.eventIndex, signal.event.time, identity, signal.event.skillId, 'effect')]
  );
}

/** Reconstructs Virtuoso Distortion actions from clustered gains of the shared Distortion buff. */
function distortionActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return clusterSignals(buffGainSignals(context, DISTORTION_BUFF), 500).flatMap((signal) =>
    hasNearbyAction(actions, DISTORTION, signal.event.time, 100)
      ? []
      : [canonicalAction(signal.eventIndex, signal.event.time, DISTORTION, signal.event.skillId, 'buff-transition')]
  );
}

/** Adds Virtuoso Bladeturn Requiem, Thousand Cuts, and Distortion actions to the generic Mesmer action stream. */
export function reconstructVirtuosoActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions];
  actions.push(
    ...effectBackedActions(
      context,
      actions,
      BLADETURN_REQUIEM,
      MESMER_EFFECT_GUIDS.virtuosoBladeturnRequiem,
      BLADETURN_REQUIEM.skillId,
      1250
    )
  );
  actions.push(
    ...effectBackedActions(
      context,
      actions,
      THOUSAND_CUTS,
      MESMER_EFFECT_GUIDS.virtuosoThousandCuts,
      THOUSAND_CUTS.skillId,
      750
    )
  );
  actions.push(...distortionActions(context, actions));
  return actions;
}
