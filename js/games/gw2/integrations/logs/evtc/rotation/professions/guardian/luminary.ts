import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { firstStrikePacketOffsetMs } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import type { EvtcRotationBuffTransition } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  canonicalAction,
  isPhysicalWeaponSwap,
  skillFor,
  SWAP_WEAPONS
} from '#gw2/integrations/logs/evtc/rotation/professions/guardian/shared.js';
import { EPSILON } from '#kernel/core/clock.js';

const INITIAL_LIGHT_AURA = Object.freeze({
  name: 'Initial Light Aura',
  skillId: 25518
});
const INITIAL_TIMED_STATES = Object.freeze([
  { buffSkillId: 873, name: 'Initial Resolution' },
  { buffSkillId: 73_955, name: 'Initial Relic of the Claw' },
  { buffSkillId: 77_169, name: 'Initial Empowered Armaments' },
  { buffSkillId: 77_360, name: 'Initial Radiant Hammer' }
]);
const ENTER_RADIANT_FORGE = Object.freeze({
  name: 'Enter Radiant Forge',
  skillId: 77073
});
const EXIT_RADIANT_FORGE = Object.freeze({
  name: 'Exit Radiant Forge',
  skillId: 76616
});
const RADIANT_COURAGE = Object.freeze({
  name: 'Radiant Courage',
  skillId: 78358
});
const RADIANT_FORGE_BUFF = 77142;
const LIGHT_AURA_BUFF = 25518;
const SOVEREIGN_OF_LIGHT_DAMAGE = 77164;
const SYMBOL_OF_LUMINANCE = Object.freeze({
  name: 'Symbol of Luminance',
  skillId: 73132
});

export const LUMINARY_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: RADIANT_FORGE_BUFF,
    gain: ENTER_RADIANT_FORGE,
    loss: EXIT_RADIANT_FORGE,
    suppressWeaponSwap: true
  },
  {
    buffSkillId: 77821,
    loss: { name: 'Radiant Justice', skillId: 78837 },
    lossRequiresRemainingDuration: true,
    suppressWeaponSwap: false
  },
  {
    buffSkillId: 77855,
    loss: { name: 'Radiant Resolve', skillId: 78514 },
    lossRequiresRemainingDuration: true,
    suppressWeaponSwap: false
  },
  {
    buffSkillId: 77893,
    loss: RADIANT_COURAGE,
    lossRequiresRemainingDuration: true,
    suppressWeaponSwap: false
  },
  {
    buffSkillId: 77095,
    gain: { name: 'Effulgent Stance', skillId: 76813 },
    suppressWeaponSwap: false
  }
];

function inferInitialSovereignAura(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const initialForge = context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === RADIANT_FORGE_BUFF &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
  );
  const sovereignObserved = context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === SOVEREIGN_OF_LIGHT_DAMAGE &&
      event.stateChange === EVTC_STATE_CHANGE.NONE
  );
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === LIGHT_AURA_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buffDamage === 4_000 &&
        event.buffDamage > event.value
    );
  if (initialForge || !sovereignObserved || !initial) return [];

  const start = initial.event.time - (initial.event.buffDamage - initial.event.value);
  // Replay the observed state directly because the buff does not identify
  // which four-second aura source produced it before logging began.
  return [
    {
      ...canonicalAction(initial.eventIndex, start, INITIAL_LIGHT_AURA, initial.event.skillId, 'initial-state'),
      precast: true
    }
  ];
}

function inferInitialTimedStates(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  return INITIAL_TIMED_STATES.flatMap(({ buffSkillId, name }) => {
    const initial = context.log.events
      .map((event, eventIndex) => ({ event, eventIndex }))
      .filter(
        ({ event }) =>
          event.target === context.playerAddress &&
          event.skillId === buffSkillId &&
          event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
          event.value > 0
      );
    if (!initial.length) return [];
    const start = Math.min(initial[0].event.time, ...context.recordedActions.map((action) => action.start));
    const initialStateDurationMs =
      initial.reduce((total, { event }) => total + event.value, 0) + (initial[0].event.time - start);
    // Duration-stacking buffs expose one BUFF_INITIAL record per queued stack;
    // replay their exact remaining total from the first imported cast rather than guessing omitted source casts.
    return [
      {
        ...canonicalAction(initial[0].eventIndex, start, { name, skillId: buffSkillId }, buffSkillId, 'initial-state'),
        initialState: true,
        precast: true,
        initialStateDurationMs
      }
    ];
  });
}

function alignOpeningSymbolCombatStart(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const sourceCombatStart = context.log.events.find(
    (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  )?.time;
  const strikeOffset = firstStrikePacketOffsetMs(skillFor(context, SYMBOL_OF_LUMINANCE), undefined, {
    explicitOnly: true
  });
  if (sourceCombatStart == null || strikeOffset == null) return [...actions];
  const opening = actions
    .filter(
      (action) =>
        (action.rawSkillId === SYMBOL_OF_LUMINANCE.skillId ||
          action.rawName.trim().toLowerCase() === SYMBOL_OF_LUMINANCE.name.toLowerCase()) &&
        action.start <= sourceCombatStart &&
        sourceCombatStart <= action.end
    )
    .sort((left, right) => right.start - left.start)[0];
  if (!opening) return [...actions];
  const firstStrikeAt = opening.start + strikeOffset;
  if (firstStrikeAt >= sourceCombatStart) return [...actions];
  // EVTC millisecond timestamps may place ENTER_COMBAT just after the modeled opening packet;
  // retain the preceding source millisecond so both same-time Symbol strikes remain observable.
  const combatStartOverride = Math.max(opening.start, firstStrikeAt - Math.ceil(EPSILON * 1_000));
  return actions.map((action) => (action === opening ? { ...action, combatStartOverride } : action));
}

export function normalizeLuminaryWeaponTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.flatMap((action) => {
    if (action.rawName !== SWAP_WEAPONS.name) return [action];
    if (!context.log.events[action.eventIndex]) return [];
    return isPhysicalWeaponSwap(context, action) ? [action] : [];
  });
}

function alignInitialRadiantForge(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const initial = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === RADIANT_FORGE_BUFF &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      event.buffDamage > event.value
  );
  if (!initial) return [...actions];
  const start = initial.time - (initial.buffDamage - initial.value);
  return actions.map((action) =>
    action.initialState === true && action.canonicalSkillId === 77073 && action.start !== start
      ? { ...action, start, end: start }
      : action
  );
}

export function reconstructLuminaryActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  // Luminary's Blessing can survive from several sources, so its initial state
  // cannot prove that Radiant Courage was cast before the recording began.
  return [
    ...alignOpeningSymbolCombatStart(context, alignInitialRadiantForge(context, actions)),
    ...inferInitialSovereignAura(context),
    ...inferInitialTimedStates(context)
  ];
}
