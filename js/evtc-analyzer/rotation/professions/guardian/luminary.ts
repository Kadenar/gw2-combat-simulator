import { EVTC_STATE_CHANGE } from "../../../types.js";
import type { EvtcRotationBuffTransition } from "../../profiles.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import {
  canonicalAction,
  isPhysicalWeaponSwap,
  SWAP_WEAPONS,
} from "./shared.js";

const RADIANT_COURAGE = Object.freeze({
  name: "Radiant Courage",
  skillId: 78358,
});
const RADIANT_FORGE_BUFF = 77142;
const LUMINARYS_BLESSING_BUFF = 77333;

export const LUMINARY_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] =
  [
    {
      buffSkillId: RADIANT_FORGE_BUFF,
      gain: { name: "Enter Radiant Forge", skillId: 77073 },
      loss: { name: "Exit Radiant Forge", skillId: 76616 },
      suppressWeaponSwap: true,
    },
    {
      buffSkillId: 77821,
      loss: { name: "Radiant Justice", skillId: 78837 },
      lossRequiresRemainingDuration: true,
      suppressWeaponSwap: false,
    },
    {
      buffSkillId: 77855,
      loss: { name: "Radiant Resolve", skillId: 78514 },
      lossRequiresRemainingDuration: true,
      suppressWeaponSwap: false,
    },
    {
      buffSkillId: 77893,
      loss: RADIANT_COURAGE,
      lossRequiresRemainingDuration: true,
      suppressWeaponSwap: false,
    },
    {
      buffSkillId: 77095,
      gain: { name: "Effulgent Stance", skillId: 76813 },
      suppressWeaponSwap: false,
    },
  ];

export function normalizeLuminaryWeaponTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return actions.flatMap((action) => {
    if (action.rawName !== SWAP_WEAPONS.name) return [action];
    if (!context.log.events[action.eventIndex]) return [];
    return isPhysicalWeaponSwap(context, action) ? [action] : [];
  });
}

function inferInitialRadiantCourage(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === LUMINARYS_BLESSING_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buffDamage > event.value,
    );
  if (!initial) return [];
  const start =
    initial.event.time - (initial.event.buffDamage - initial.event.value);
  return [
    {
      ...canonicalAction(
        initial.eventIndex,
        start,
        RADIANT_COURAGE,
        initial.event.skillId,
        "initial-state",
      ),
      precast: true,
    },
  ];
}

function alignInitialRadiantForge(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const initial = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === RADIANT_FORGE_BUFF &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      event.buffDamage > event.value,
  );
  if (!initial) return [...actions];
  const start = initial.time - (initial.buffDamage - initial.value);
  return actions.map((action) =>
    action.initialState === true &&
    action.canonicalSkillId === 77073 &&
    action.start !== start
      ? { ...action, start, end: start }
      : action,
  );
}

export function reconstructLuminaryActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return [
    ...alignInitialRadiantForge(context, actions),
    ...inferInitialRadiantCourage(context),
  ];
}
