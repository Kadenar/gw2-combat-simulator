import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { effectSignals } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  assembleRevenantActions,
  firstActionAnchor,
  initialEnchantedDaggersActions,
  legendSwapActions,
  recoverRevenantPrecastActions
} from '#gw2/integrations/logs/evtc/rotation/professions/revenant/common.js';
import {
  directAction,
  hasRecordedAction,
  playerInstance,
  rawSkillName,
  runtimeDuration,
  skillFor,
  type RevenantActionIdentity
} from '#gw2/integrations/logs/evtc/rotation/professions/revenant/shared.js';

const ORDERS_FROM_ABOVE = Object.freeze({
  name: 'Orders from Above',
  skillId: 45537
});
// Elite Insights RenegadeHelper: normal Orders from Above and its Righteous Rebel variant.
const ORDERS_FROM_ABOVE_EFFECT_GUIDS = ['B63D192DED78B1489DDB6E742D603CE5', 'F53F05F041957A47AD62B522FE030408'];
const TERMINAL_RAZORCLAW_INPUT_DELAY_MS = 100;

const WARBAND_SPECIES_ACTIONS = new Map<number, RevenantActionIdentity>([
  [18524, { name: "Icerazor's Ire", skillId: 40485 }],
  [18791, { name: "Razorclaw's Rage", skillId: 42949 }],
  [18806, { name: "Breakrazor's Bastion", skillId: 45686 }],
  [18594, { name: "Darkrazor's Daring", skillId: 41220 }],
  [19002, { name: "Soulcleave's Summit", skillId: 45773 }]
]);

const WARBAND_ANIMATION_ACTIONS = new Map<number, RevenantActionIdentity>([
  [72353, { name: "Icerazor's Ire", skillId: 40485 }],
  [72370, { name: "Razorclaw's Rage", skillId: 42949 }],
  [72360, { name: "Darkrazor's Daring", skillId: 41220 }],
  [72365, { name: "Breakrazor's Bastion", skillId: 45686 }],
  [42614, { name: "Soulcleave's Summit", skillId: 45773 }]
]);

const WARBAND_EFFECT_ACTIONS = new Map<string, RevenantActionIdentity>([
  ['72FC15613B4B2C44A1906617998859F9', { name: "Breakrazor's Bastion", skillId: 45686 }],
  ['71B04F91F9B3DF4A8954059FCFAD630E', { name: "Razorclaw's Rage", skillId: 42949 }],
  ['C8FDB04E59C1034CABEFBECE470AA1BC', { name: "Darkrazor's Daring", skillId: 41220 }],
  ['E725FC2FD486A84EBEAC403DB4DA30DE', { name: "Icerazor's Ire", skillId: 40485 }]
]);

/** Match EI's BandTogetherCastFinder: the player's summon effect proves an instant input unless the base cast is active. */
function enhancedWarbandActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  return [...WARBAND_EFFECT_ACTIONS].flatMap(([guid, identity]) => {
    let previousTime = Number.NEGATIVE_INFINITY;
    return effectSignals(context, guid).flatMap(({ event, eventIndex }) => {
      const duplicate = event.time - previousTime < 50;
      previousTime = event.time;
      if (
        duplicate ||
        context.recordedActions.some(
          (action) =>
            (action.rawSkillId === identity.skillId ||
              action.canonicalSkillId === identity.skillId ||
              action.rawName === identity.name) &&
            action.start <= event.time &&
            event.time <= action.end
        )
      )
        return [];
      return [
        {
          ...directAction(eventIndex, event.time, identity.skillId, identity.name, identity, 'effect'),
          // Enhanced inputs are instant; the base cast time must not consume later idle gaps.
          replayDurationMs: 0,
          concurrentTimeline: true
        }
      ];
    });
  });
}

function ordersFromAboveActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  // Match EI's effect timestamp and 50 ms duplicate window; alacrity snapshots/pulses never establish a cast time.
  return ORDERS_FROM_ABOVE_EFFECT_GUIDS.flatMap((guid) => {
    let previousTime = Number.NEGATIVE_INFINITY;
    return effectSignals(context, guid).flatMap(({ event, eventIndex }) => {
      const duplicate = event.time - previousTime < 50;
      previousTime = event.time;
      if (duplicate || hasRecordedAction(context.recordedActions, ORDERS_FROM_ABOVE, event.time)) return [];
      return [directAction(eventIndex, event.time, event.skillId, ORDERS_FROM_ABOVE.name, ORDERS_FROM_ABOVE, 'effect')];
    });
  });
}

function initialWarbandActions(
  context: EvtcProfessionReconstructionContext,
  anchor: number
): EvtcRecordedRotationAction[] {
  if (!Number.isFinite(anchor)) return [];
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const initialAddresses = new Set(
    context.log.events
      .filter(
        (event) =>
          event.source !== context.playerAddress &&
          event.sourceMasterInstance === ownerInstance &&
          event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
      )
      .map((event) => event.source)
  );
  const identities = context.log.agents.flatMap((agent) => {
    if (!initialAddresses.has(agent.address)) return [];
    const identity = WARBAND_SPECIES_ACTIONS.get(agent.profession);
    return identity ? [identity] : [];
  });
  // The initial actor snapshot proves the summon completed before the first retained cast, so pack its runtime
  // immediately before that evidence instead of inventing an unobserved setup gap.
  let cursor = anchor;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = identities.length - 1; index >= 0; index -= 1) {
    const identity = identities[index];
    const duration = runtimeDuration(context, identity);
    cursor -= duration;
    reversed.push({
      ...directAction(-4000 + index, cursor, identity.skillId, identity.name, identity, 'initial-state', duration),
      precast: true
    });
  }

  return reversed.reverse();
}

function warbandActorActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const legendSwaps = legendSwapActions(context);
  return context.log.events.flatMap((event, eventIndex) => {
    const identity = WARBAND_ANIMATION_ACTIONS.get(event.skillId);
    if (
      !identity ||
      event.sourceMasterInstance !== ownerInstance ||
      event.source === context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_START ||
      actions.some(
        (action) =>
          (action.rawSkillId === identity.skillId ||
            action.canonicalSkillId === identity.skillId ||
            action.rawName === identity.name) &&
          action.start <= event.time &&
          event.time - action.start <= 1000
      )
    ) {
      return [];
    }

    const swapsImmediatelyAfter = legendSwaps.some(
      (swap) => swap.start >= event.time && swap.start - event.time <= 250
    );
    const isTerminalRazorclaw = identity.skillId === 42949 && !legendSwaps.some((swap) => swap.start > event.time);
    const nextAutoattack = isTerminalRazorclaw
      ? actions.find(
          (action) =>
            action.start >= event.time &&
            String(
              skillFor(context, {
                name: action.canonicalName || action.rawName,
                skillId: action.canonicalSkillId ?? action.rawSkillId
              })?.slot || ''
            ).toLowerCase() === 'weapon_1'
        )
      : undefined;
    // The terminal actor packet shares the next autoattack timestamp but follows its input boundary.
    const start = nextAutoattack
      ? nextAutoattack.start + TERMINAL_RAZORCLAW_INPUT_DELAY_MS
      : event.time - (swapsImmediatelyAfter ? 200 : 0);
    return [
      {
        ...directAction(
          nextAutoattack ? nextAutoattack.eventIndex + 0.25 : eventIndex,
          start,
          event.skillId,
          rawSkillName(context, event.skillId),
          identity,
          'animation'
        ),
        // Band Together's enhanced summon overlaps the active cast, then anchors the next scheduler offset.
        replayDurationMs: 0,
        concurrentTimeline: true
      }
    ];
  });
}

export function reconstructRenegadeActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const recoveredPrecasts = recoverRevenantPrecastActions(context);
  const firstAnchor = firstActionAnchor(context, recoveredPrecasts);
  const initialWarband = initialWarbandActions(context, firstAnchor);
  const warbandAnchor = Math.min(...initialWarband.map((action) => action.start), firstAnchor);
  const actions = assembleRevenantActions(context, {
    initialActions: [...initialEnchantedDaggersActions(context, warbandAnchor), ...initialWarband],
    recoveredPrecasts,
    afterUpkeepActions: [...ordersFromAboveActions(context), ...enhancedWarbandActions(context)]
  });
  return [...actions, ...warbandActorActions(context, actions)];
}
