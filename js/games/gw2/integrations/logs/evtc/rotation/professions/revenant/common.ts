import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { firstStrikePacketOffsetMs } from '#gw2/integrations/logs/lib/rotation/timing.js';
import { catalogSkillById } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  combatStart,
  directAction,
  hasRecordedAction,
  rawSkillName,
  runtimeDuration,
  skillFor,
  SIGNAL_DEDUPLICATION_WINDOW_MS,
  SWAP_LEGENDS,
  type RevenantActionIdentity
} from '#gw2/integrations/logs/evtc/rotation/professions/revenant/shared.js';

const ENCHANTED_DAGGERS = Object.freeze({
  name: 'Enchanted Daggers',
  skillId: 26937
});
const IMPOSSIBLE_ODDS = Object.freeze({
  name: 'Impossible Odds',
  skillId: 27107
});
const SPIRITCRUSH = Object.freeze({ name: 'Spiritcrush', skillId: 43993 });
const DROP_THE_HAMMER = Object.freeze({ name: 'Drop the Hammer', skillId: 28110 });
const LEGEND_STANCE_NAME = /^Legendary .+ Stance$/;
const ENCHANTED_DAGGERS_BUFF = 28557;
const IMPOSSIBLE_ODDS_BUFF = 27581;
const SPIRITCRUSH_FIRST_HIT_DELAY_MS = 1320;

const TRUNCATED_PRECASTS = new Map<number, RevenantActionIdentity>([
  [28357, { name: 'Searing Fissure', skillId: 28357 }],
  [28472, { name: 'Shackling Wave', skillId: 28472 }],
  [41829, { name: 'Sevenshot', skillId: 41829 }]
]);

interface RevenantActionAssembly {
  readonly initialActions?: readonly EvtcRecordedRotationAction[];
  readonly recoveredPrecasts: readonly EvtcRecordedRotationAction[];
  readonly beforeUpkeepActions?: readonly EvtcRecordedRotationAction[];
  readonly afterUpkeepActions?: readonly EvtcRecordedRotationAction[];
}

export function legendSwapActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    // ArcDPS revisions use either the explicit BUFF_APPLY state change or a
    // normal buff packet for the same stance-gain signal.
    const buffApplication =
      event.stateChange === EVTC_STATE_CHANGE.NONE || event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY;
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      !buffApplication ||
      !LEGEND_STANCE_NAME.test(rawSkillName(context, event.skillId))
    ) {
      return [];
    }

    return [directAction(eventIndex, event.time, event.skillId, rawSkillName(context, event.skillId), SWAP_LEGENDS)];
  });
}

function upkeepActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const parent = skillFor(context, IMPOSSIBLE_ODDS);
  const release = parent?.flipSkillId == null ? null : catalogSkillById(context.catalog, Number(parent.flipSkillId));
  const swaps = legendSwapActions(context);
  return context.log.events.flatMap((event, eventIndex) => {
    // Keep upkeep recovery compatible with both normal and explicit buff-apply packets.
    const buffApplication =
      event.stateChange === EVTC_STATE_CHANGE.NONE || event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY;
    const buffRemoval =
      (event.stateChange === EVTC_STATE_CHANGE.NONE || event.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_ALL) &&
      event.buffRemove === 1;
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== IMPOSSIBLE_ODDS_BUFF ||
      event.buff === 0 ||
      !((buffApplication && event.buffRemove === 0) || buffRemoval)
    ) {
      return [];
    }

    if (buffRemoval) {
      // A restart before starvation's cooldown proves a manual release; stance swaps clear upkeep themselves.
      if (!release || swaps.some((swap) => Math.abs(swap.start - event.time) <= SIGNAL_DEDUPLICATION_WINDOW_MS))
        return [];
      const restart = context.log.events.find(
        (next) =>
          next.time > event.time &&
          next.source === context.playerAddress &&
          next.target === context.playerAddress &&
          next.skillId === IMPOSSIBLE_ODDS_BUFF &&
          next.buff !== 0 &&
          next.buffRemove === 0 &&
          (next.stateChange === EVTC_STATE_CHANGE.NONE || next.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY)
      );
      if (
        !restart ||
        restart.time - event.time >= Number(parent?.starvationCooldown || 0) * 1000 ||
        hasRecordedAction(context.recordedActions, { name: release.name, skillId: Number(release.id) }, event.time)
      )
        return [];
      return [
        directAction(eventIndex, event.time, event.skillId, release.name, {
          name: release.name,
          skillId: Number(release.id)
        })
      ];
    }

    return [directAction(eventIndex, event.time, event.skillId, rawSkillName(context, event.skillId), IMPOSSIBLE_ODDS)];
  });
}

function truncatedPrecastActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    const identity = TRUNCATED_PRECASTS.get(event.skillId);
    if (
      !identity ||
      event.source !== context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }

    const start = event.time - event.value;
    if (
      start >= atCombat ||
      // Match the recovered cast start so a generic truncated animation is not inserted twice.
      hasRecordedAction(context.recordedActions, identity, start, SIGNAL_DEDUPLICATION_WINDOW_MS)
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
          'animation',
          event.value
        ),
        expectedDuration: Math.max(event.value, event.buffDamage),
        precast: true
      }
    ];
  });
}

function truncatedSpiritcrushActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
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
        event.time <= atCombat + 2000
    );
  if (!firstSignal) return [];
  const duration = runtimeDuration(context, SPIRITCRUSH);
  const end = firstSignal.event.time - SPIRITCRUSH_FIRST_HIT_DELAY_MS;
  const start = end - duration;
  if (start >= atCombat || hasRecordedAction(actions, SPIRITCRUSH, start, SIGNAL_DEDUPLICATION_WINDOW_MS)) {
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
        'initial-state',
        duration
      ),
      precast: true
    }
  ];
}

export function recoverRevenantPrecastActions(
  context: EvtcProfessionReconstructionContext
): EvtcRecordedRotationAction[] {
  const truncated = truncatedPrecastActions(context);
  const actions = [...context.recordedActions, ...truncated];
  return [...truncated, ...truncatedSpiritcrushActions(context, actions), ...truncatedHammerActions(context, actions)];
}

/** Recover the opening delayed hammer strike so its Coalescence reset survives a missing precast animation. */
function truncatedHammerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  const impactMs = firstStrikePacketOffsetMs(skillFor(context, DROP_THE_HAMMER));
  if (atCombat == null || impactMs == null) return [];
  const signal = context.log.events.findIndex(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === DROP_THE_HAMMER.skillId &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === EVTC_ACTIVATION.NONE &&
      event.buff === 0 &&
      event.value > 0 &&
      event.time >= atCombat &&
      event.time < atCombat + impactMs
  );
  if (signal < 0) return [];
  const start = context.log.events[signal]!.time - impactMs;
  if (hasRecordedAction(actions, DROP_THE_HAMMER, start, SIGNAL_DEDUPLICATION_WINDOW_MS)) return [];
  return [
    {
      ...directAction(
        signal,
        start,
        DROP_THE_HAMMER.skillId,
        DROP_THE_HAMMER.name,
        DROP_THE_HAMMER,
        'initial-state',
        runtimeDuration(context, DROP_THE_HAMMER)
      ),
      precast: true
    }
  ];
}

export function firstActionAnchor(
  context: EvtcProfessionReconstructionContext,
  recoveredPrecasts: readonly EvtcRecordedRotationAction[]
): number {
  return Math.min(
    ...recoveredPrecasts.map((action) => action.start),
    ...context.recordedActions.map((action) => action.start),
    combatStart(context) ?? Number.POSITIVE_INFINITY
  );
}

export function initialEnchantedDaggersActions(
  context: EvtcProfessionReconstructionContext,
  anchor: number
): EvtcRecordedRotationAction[] {
  const configuredLegend = String(context.professionConfig?.startingLegend || '');
  if (
    !Number.isFinite(anchor) ||
    // An inherited Enchanted Daggers buff is not a replayable input when the active build explicitly starts elsewhere.
    (configuredLegend && configuredLegend !== 'LegendaryAssassin') ||
    !context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === ENCHANTED_DAGGERS_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
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
        'initial-state',
        duration
      ),
      precast: true
    }
  ];
  const initialStance = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      LEGEND_STANCE_NAME.test(rawSkillName(context, event.skillId))
  );
  if (initialStance && rawSkillName(context, initialStance.skillId) !== 'Legendary Assassin Stance') {
    actions.push({
      ...directAction(-6001, anchor, 0, SWAP_LEGENDS.name, SWAP_LEGENDS, 'initial-state'),
      precast: true
    });
  }

  return actions;
}

export function assembleRevenantActions(
  context: EvtcProfessionReconstructionContext,
  assembly: RevenantActionAssembly
): EvtcRecordedRotationAction[] {
  return [
    ...context.recordedActions,
    ...(assembly.initialActions || []),
    ...assembly.recoveredPrecasts,
    ...legendSwapActions(context),
    ...(assembly.beforeUpkeepActions || []),
    ...upkeepActions(context),
    ...(assembly.afterUpkeepActions || [])
  ];
}

export function reconstructCommonRevenantActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const recoveredPrecasts = recoverRevenantPrecastActions(context);
  const anchor = firstActionAnchor(context, recoveredPrecasts);
  return assembleRevenantActions(context, {
    initialActions: initialEnchantedDaggersActions(context, anchor),
    recoveredPrecasts
  });
}
