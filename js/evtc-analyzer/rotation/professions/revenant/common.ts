import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../../types.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import {
  combatStart,
  directAction,
  hasRecordedAction,
  rawSkillName,
  runtimeDuration,
  SIGNAL_DEDUPLICATION_WINDOW_MS,
  SWAP_LEGENDS,
  type RevenantActionIdentity,
} from "./shared.js";

const ENCHANTED_DAGGERS = Object.freeze({
  name: "Enchanted Daggers",
  skillId: 26937,
});
const IMPOSSIBLE_ODDS = Object.freeze({
  name: "Impossible Odds",
  skillId: 27107,
});
const SPIRITCRUSH = Object.freeze({ name: "Spiritcrush", skillId: 43993 });
const LEGEND_STANCE_NAME = /^Legendary .+ Stance$/;
const ENCHANTED_DAGGERS_BUFF = 28557;
const IMPOSSIBLE_ODDS_BUFF = 27581;
const SPIRITCRUSH_FIRST_HIT_DELAY_MS = 1320;

const TRUNCATED_PRECASTS = new Map<number, RevenantActionIdentity>([
  [28357, { name: "Searing Fissure", skillId: 28357 }],
  [28472, { name: "Shackling Wave", skillId: 28472 }],
  [41829, { name: "Sevenshot", skillId: 41829 }],
]);

interface RevenantActionAssembly {
  readonly initialActions?: readonly EvtcRecordedRotationAction[];
  readonly recoveredPrecasts: readonly EvtcRecordedRotationAction[];
  readonly beforeUpkeepActions?: readonly EvtcRecordedRotationAction[];
  readonly afterUpkeepActions?: readonly EvtcRecordedRotationAction[];
}

export function legendSwapActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      !LEGEND_STANCE_NAME.test(rawSkillName(context, event.skillId))
    ) {
      return [];
    }
    return [
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        SWAP_LEGENDS,
      ),
    ];
  });
}

function upkeepActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== IMPOSSIBLE_ODDS_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY
    ) {
      return [];
    }
    return [
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        IMPOSSIBLE_ODDS,
      ),
    ];
  });
}

function truncatedPrecastActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    const identity = TRUNCATED_PRECASTS.get(event.skillId);
    if (
      !identity ||
      event.source !== context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE &&
        event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }
    const start = event.time - event.value;
    if (
      start >= atCombat ||
      hasRecordedAction(
        context.recordedActions,
        identity,
        event.time,
        SIGNAL_DEDUPLICATION_WINDOW_MS,
      )
    ) {
      return [];
    }
    return [
      {
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          rawSkillName(context, event.skillId),
          identity,
          "animation",
          event.value,
        ),
        expectedDuration: Math.max(event.value, event.buffDamage),
        precast: true,
      },
    ];
  });
}

function truncatedSpiritcrushActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  const firstSignal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === SPIRITCRUSH.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0 &&
        event.time <= atCombat + 2000,
    );
  if (!firstSignal) return [];
  const duration = runtimeDuration(context, SPIRITCRUSH);
  const end = firstSignal.event.time - SPIRITCRUSH_FIRST_HIT_DELAY_MS;
  const start = end - duration;
  if (
    start >= atCombat ||
    hasRecordedAction(
      actions,
      SPIRITCRUSH,
      start,
      SIGNAL_DEDUPLICATION_WINDOW_MS,
    )
  ) {
    return [];
  }
  return [
    {
      ...directAction(
        firstSignal.eventIndex,
        start,
        firstSignal.event.skillId,
        SPIRITCRUSH.name,
        SPIRITCRUSH,
        "initial-state",
        duration,
      ),
      precast: true,
    },
  ];
}

export function recoverRevenantPrecastActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const truncated = truncatedPrecastActions(context);
  return [
    ...truncated,
    ...truncatedSpiritcrushActions(context, [
      ...context.recordedActions,
      ...truncated,
    ]),
  ];
}

export function firstActionAnchor(
  context: EvtcProfessionReconstructionContext,
  recoveredPrecasts: readonly EvtcRecordedRotationAction[],
): number {
  return Math.min(
    ...recoveredPrecasts.map((action) => action.start),
    ...context.recordedActions.map((action) => action.start),
    combatStart(context) ?? Number.POSITIVE_INFINITY,
  );
}

export function initialEnchantedDaggersActions(
  context: EvtcProfessionReconstructionContext,
  anchor: number,
): EvtcRecordedRotationAction[] {
  if (
    !Number.isFinite(anchor) ||
    !context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === ENCHANTED_DAGGERS_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
    )
  ) {
    return [];
  }
  const duration = runtimeDuration(context, ENCHANTED_DAGGERS);
  const actions: EvtcRecordedRotationAction[] = [
    {
      ...directAction(
        -6002,
        anchor - duration,
        ENCHANTED_DAGGERS_BUFF,
        ENCHANTED_DAGGERS.name,
        ENCHANTED_DAGGERS,
        "initial-state",
        duration,
      ),
      precast: true,
    },
  ];
  const initialStance = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      LEGEND_STANCE_NAME.test(rawSkillName(context, event.skillId)),
  );
  if (
    initialStance &&
    rawSkillName(context, initialStance.skillId) !== "Legendary Assassin Stance"
  ) {
    actions.push({
      ...directAction(
        -6001,
        anchor,
        0,
        SWAP_LEGENDS.name,
        SWAP_LEGENDS,
        "initial-state",
      ),
      precast: true,
    });
  }
  return actions;
}

export function assembleRevenantActions(
  context: EvtcProfessionReconstructionContext,
  assembly: RevenantActionAssembly,
): EvtcRecordedRotationAction[] {
  return [
    ...context.recordedActions,
    ...(assembly.initialActions || []),
    ...assembly.recoveredPrecasts,
    ...legendSwapActions(context),
    ...(assembly.beforeUpkeepActions || []),
    ...upkeepActions(context),
    ...(assembly.afterUpkeepActions || []),
  ];
}

export function reconstructCommonRevenantActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const recoveredPrecasts = recoverRevenantPrecastActions(context);
  const anchor = firstActionAnchor(context, recoveredPrecasts);
  return assembleRevenantActions(context, {
    initialActions: initialEnchantedDaggersActions(context, anchor),
    recoveredPrecasts,
  });
}
