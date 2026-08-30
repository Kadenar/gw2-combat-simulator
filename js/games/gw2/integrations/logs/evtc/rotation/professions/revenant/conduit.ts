import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { reconstructCommonRevenantActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/common.js';
import {
  directAction,
  hasRecordedAction,
  runtimeDuration,
  SIGNAL_DEDUPLICATION_WINDOW_MS
} from '#gw2/integrations/logs/evtc/rotation/professions/revenant/shared.js';

const COSMIC_WISDOM_BUFF_ID = 76559;
const COSMIC_WISDOM = Object.freeze({
  name: 'Cosmic Wisdom',
  skillId: 77371
});
const HEX_EATER_VORTEX = Object.freeze({
  name: 'Hex-Eater Vortex',
  skillId: 77243
});
const TEMPORAL_RIFT = Object.freeze({
  name: 'Temporal Rift',
  skillId: 28409
});
const TEMPORAL_RIFT_IMPACT_DELAY_MS = 640;

function initialStateTime(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find(
      (event) => event.target === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
    )?.time ?? null
  );
}

function primaryTargetObservationEnd(context: EvtcProfessionReconstructionContext): number | null {
  const damagePacketsByTarget = new Map<bigint, number>();
  for (const event of context.log.events) {
    if (
      event.source !== context.playerAddress ||
      event.target === 0n ||
      event.target === context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      (event.value <= 0 && event.buffDamage <= 0)
    ) {
      continue;
    }

    damagePacketsByTarget.set(event.target, (damagePacketsByTarget.get(event.target) || 0) + 1);
  }

  const primaryTarget = [...damagePacketsByTarget].sort((left, right) => right[1] - left[1])[0]?.[0];
  if (primaryTarget == null) return null;

  // Arc keeps recording player animations briefly after a golem dies. Bound the import to the primary damage
  // target's terminal event so those post-phase casts do not become simulator inputs.
  return (
    context.log.events
      .filter(
        (event) =>
          event.source === primaryTarget &&
          (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
      )
      .sort((left, right) => left.time - right.time)[0]?.time ?? null
  );
}

function truncatedHexEaterVortexActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const combatStart = initialStateTime(context);
  if (combatStart == null) return [];
  const stop = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === HEX_EATER_VORTEX.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        (event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET) &&
        event.value > 0 &&
        event.time - event.value < combatStart &&
        event.time >= combatStart
    );
  if (
    !stop ||
    hasRecordedAction(
      context.recordedActions,
      HEX_EATER_VORTEX,
      stop.event.time - stop.event.value,
      SIGNAL_DEDUPLICATION_WINDOW_MS
    )
  ) {
    return [];
  }

  // The golem log can begin after the cast-start packet but retain the stop
  // duration, which reconstructs the exact precast boundary used by EI.
  return [
    {
      ...directAction(
        stop.eventIndex,
        stop.event.time - stop.event.value,
        stop.event.skillId,
        HEX_EATER_VORTEX.name,
        HEX_EATER_VORTEX,
        'legacy-activation',
        stop.event.value
      ),
      expectedDuration: Math.max(stop.event.value, stop.event.buffDamage),
      precast: true
    }
  ];
}

function temporalRiftPrecastActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const combatStart = initialStateTime(context);
  if (combatStart == null) return [];
  const firstImpact = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === TEMPORAL_RIFT.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0 &&
        event.time <= combatStart + TEMPORAL_RIFT_IMPACT_DELAY_MS
    );
  if (!firstImpact) return [];
  const duration = runtimeDuration(context, TEMPORAL_RIFT);
  const start = firstImpact.event.time - TEMPORAL_RIFT_IMPACT_DELAY_MS - duration;
  if (
    start >= combatStart ||
    hasRecordedAction(context.recordedActions, TEMPORAL_RIFT, start, SIGNAL_DEDUPLICATION_WINDOW_MS)
  ) {
    return [];
  }

  // Temporal Rift can begin before Arc's initial-state boundary, so recover its input from the first delayed hit.
  return [
    {
      ...directAction(
        firstImpact.eventIndex,
        start,
        firstImpact.event.skillId,
        TEMPORAL_RIFT.name,
        TEMPORAL_RIFT,
        'initial-state',
        duration
      ),
      precast: true
    }
  ];
}

function cosmicWisdomActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  // Arc records the player input as a seven-second buff application (76559),
  // while legend swaps extend that buff from source 0 and must not create casts.
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== COSMIC_WISDOM_BUFF_ID ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY)
    ) {
      return [];
    }

    return [directAction(eventIndex, event.time, event.skillId, COSMIC_WISDOM.name, COSMIC_WISDOM, 'buff-transition')];
  });
}

/** Recovers Conduit inputs that Arc exposes only through their resulting buff state. */
export function reconstructConduitActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const observationEnd = primaryTargetObservationEnd(context);
  return [
    ...reconstructCommonRevenantActions(context),
    ...temporalRiftPrecastActions(context),
    ...truncatedHexEaterVortexActions(context),
    ...cosmicWisdomActions(context)
  ].filter((action) => observationEnd == null || action.start < observationEnd);
}
