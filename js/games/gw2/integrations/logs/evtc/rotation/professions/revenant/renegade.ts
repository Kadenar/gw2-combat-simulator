import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
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
const ALACRITY_BUFF = 30328;
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
  [42614, { name: "Soulcleave's Summit", skillId: 45773 }]
]);

function ordersFromAboveActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  let previousPulse: number | null = null;
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== ALACRITY_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY
    ) {
      return;
    }

    const beginsActivation = previousPulse == null || event.time - previousPulse > 1500;
    previousPulse = event.time;
    if (!beginsActivation) return;
    actions.push(
      directAction(eventIndex, event.time, event.skillId, rawSkillName(context, event.skillId), ORDERS_FROM_ABOVE)
    );
  });
  return actions;
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
    afterUpkeepActions: ordersFromAboveActions(context)
  });
  return [...actions, ...warbandActorActions(context, actions)];
}
