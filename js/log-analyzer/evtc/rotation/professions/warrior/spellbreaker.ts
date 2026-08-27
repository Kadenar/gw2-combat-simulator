import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { sequentialWarriorCorePrecasts } from './common.js';
import { combatStart, initialAction, recordedDuration, type WarriorActionIdentity } from './shared.js';

const WINDS_OF_DISENCHANTMENT = Object.freeze({
  name: 'Winds of Disenchantment',
  skillId: 45333
});
const BREACHING_STRIKE_IDS = new Set([45252, 69297, 69433]);
const INITIAL_SIGNAL_WINDOW_MS = 1000;

/**
 * Rebuilds a Spellbreaker opener when a precombat Breaching Strike has no
 * paired recorded action but its animation-stop event survives. That stop
 * anchors both Breaching Strike and any initial-state core precasts.
 */
function spellbreakerPrecasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);

  if (atCombat == null) return [];
  const unmatchedBreachingStop = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        BREACHING_STRIKE_IDS.has(event.skillId) &&
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
        event.value > 0 &&
        event.time - event.value < atCombat &&
        !actions.some(
          (action) => BREACHING_STRIKE_IDS.has(action.rawSkillId) && Math.abs(action.end - event.time) <= 50
        )
    );

  if (!unmatchedBreachingStop) return [];

  // Retain the observed variant ID so logs/catalogs from either ArcDPS ID
  // generation still resolve the same Breaching Strike cast.
  const breachingIdentity: WarriorActionIdentity = {
    name: 'Breaching Strike',
    skillId: unmatchedBreachingStop.event.skillId
  };
  const breachingStart = unmatchedBreachingStop.event.time - unmatchedBreachingStop.event.value;
  const breaching: EvtcRecordedRotationAction = {
    ...initialAction(context, breachingIdentity, breachingStart, unmatchedBreachingStop.eventIndex),
    end: unmatchedBreachingStop.event.time,
    expectedDuration: Math.max(unmatchedBreachingStop.event.value, unmatchedBreachingStop.event.buffDamage),
    evidence: 'animation'
  };

  // Winds may begin before the log but leave its first damaging/effect pulse
  // near EnterCombat. Place it immediately before the Breaching Strike anchor.
  const firstWindsPulse = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === WINDS_OF_DISENCHANTMENT.skillId &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.time <= atCombat + INITIAL_SIGNAL_WINDOW_MS
    );
  const windsDuration = firstWindsPulse ? recordedDuration(context, WINDS_OF_DISENCHANTMENT) : 0;
  const windsStart = breachingStart - windsDuration;
  const core = sequentialWarriorCorePrecasts(
    context,
    ['healingSignet', 'signetOfMight', 'kick', 'signetOfFury'],
    windsStart,
    -2000
  );
  return [
    ...core,
    ...(firstWindsPulse
      ? [initialAction(context, WINDS_OF_DISENCHANTMENT, windsStart, firstWindsPulse.eventIndex)]
      : []),
    breaching
  ];
}

/** Prepends a Spellbreaker opening sequence only when surviving animation evidence proves its timing. */
export function reconstructSpellbreakerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return [...spellbreakerPrecasts(context, actions), ...actions];
}
