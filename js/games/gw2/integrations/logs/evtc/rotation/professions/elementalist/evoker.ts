import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { weaponSkillChargeGain } from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { findRotationSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import {
  firstStrikePacketOffsetMs,
  quicknessRuntimeDurationMs,
  skillForAction
} from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { playerInstance } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

const EVOKER_SKILL_ALIASES = new Map([
  [76803, { name: 'Zap', skillId: ID.ZAP }],
  [76925, { name: 'Calcify', skillId: ID.CALCIFY }],
  [76707, { name: 'Seismic Impact', skillId: ID.SEISMIC_IMPACT }],
  [77247, { name: "Toad's Fortitude", skillId: ID.TOADS_FORTITUDE }]
]);
const CALCIFY_RAW_SKILL_ID = 76925;
const IGNITE_RAW_SKILL_ID = 76882;
const ZAP_RAW_SKILL_ID = 76803;
const CALCIFY = Object.freeze({ name: 'Calcify', skillId: ID.CALCIFY });
const IGNITE = Object.freeze({ name: 'Ignite', skillId: ID.IGNITE });
const ZAP = Object.freeze({ name: 'Zap', skillId: ID.ZAP });
const EVOKER_ELEMENTS = new Set<ElementalistAttunement>(['Fire', 'Water', 'Air', 'Earth']);
const OPENING_SIGNAL_WINDOW_MS = 150;

interface EvokerChargeGrant {
  readonly at: number;
  readonly actionStart: number;
  readonly eventIndex: number;
  readonly gain: number;
  readonly fillsCharges: boolean;
}

function calcifyEffectCommitted(context: EvtcProfessionReconstructionContext, start: number, end: number): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === CALCIFY_RAW_SKILL_ID &&
      event.time >= start &&
      event.time <= end &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === EVTC_ACTIVATION.NONE &&
      event.buff === 0 &&
      event.value > 0 &&
      event.target !== 0n
  );
}

function matchingCalcifyStop(
  start: ParsedEvtcEvent,
  stops: readonly { readonly event: ParsedEvtcEvent; readonly eventIndex: number }[],
  matchedStopIndexes: ReadonlySet<number>
): { readonly event: ParsedEvtcEvent; readonly eventIndex: number } | null {
  return (
    stops.find(
      ({ event, eventIndex }) =>
        !matchedStopIndexes.has(eventIndex) &&
        event.source === start.source &&
        event.time > start.time &&
        Math.abs(event.time - start.time - event.value) <= 150
    ) ?? null
  );
}

function calcifyAction(
  event: ParsedEvtcEvent,
  eventIndex: number,
  start: number,
  precast = false
): EvtcRecordedRotationAction {
  return {
    start,
    end: start,
    expectedDuration: 0,
    rawSkillId: event.skillId,
    rawName: CALCIFY.name,
    canonicalSkillId: CALCIFY.skillId,
    canonicalName: CALCIFY.name,
    evidence: 'animation',
    status: 'instant',
    eventIndex,
    ...(precast ? { precast: true } : {})
  };
}

function calcifyActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const ownedEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(({ event }) => event.sourceMasterInstance === ownerInstance && event.skillId === CALCIFY_RAW_SKILL_ID);
  const starts = ownedEvents.filter(({ event }) => event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START);
  const stops = ownedEvents.filter(
    ({ event }) => event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP && event.value > 0
  );
  const matchedStopIndexes = new Set<number>();
  const actions = starts.flatMap(({ event, eventIndex }) => {
    const stop = matchingCalcifyStop(event, stops, matchedStopIndexes);
    if (stop) matchedStopIndexes.add(stop.eventIndex);
    // Seismic Impact can cancel the familiar's visual animation after Calcify
    // committed; keep that input, but do not replay an uncommitted cancellation.
    if (
      stop?.event.activation === EVTC_ACTIVATION.CANCEL_CANCEL &&
      !calcifyEffectCommitted(context, event.time, stop.event.time)
    ) {
      return [];
    }

    return [calcifyAction(event, eventIndex, event.time)];
  });

  for (const { event, eventIndex } of stops) {
    if (matchedStopIndexes.has(eventIndex)) continue;
    const start = event.time - event.value;
    if (event.activation === EVTC_ACTIVATION.CANCEL_CANCEL && !calcifyEffectCommitted(context, start, event.time)) {
      continue;
    }

    actions.push(calcifyAction(event, eventIndex, start, true));
  }

  return actions;
}

function zapActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];

  // ArcDPS records the player's instant Zap input as the owned Air familiar's
  // animation start; each start is one replayable input even if its visual is cancelled.
  return context.log.events.flatMap((event, eventIndex) =>
    event.sourceMasterInstance === ownerInstance &&
    event.skillId === ZAP_RAW_SKILL_ID &&
    event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START
      ? [
          {
            start: event.time,
            end: event.time,
            expectedDuration: 0,
            rawSkillId: event.skillId,
            rawName: ZAP.name,
            canonicalSkillId: ZAP.skillId,
            canonicalName: ZAP.name,
            evidence: 'animation' as const,
            status: 'instant' as const,
            eventIndex
          }
        ]
      : []
  );
}

function isOwnedAnimationStart(event: ParsedEvtcEvent, ownerInstance: number, skillId: number): boolean {
  return (
    event.sourceMasterInstance === ownerInstance &&
    event.skillId === skillId &&
    (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
      (event.stateChange === EVTC_STATE_CHANGE.NONE &&
        (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS)))
  );
}

function igniteAction(
  event: ParsedEvtcEvent,
  eventIndex: number,
  start: number,
  precast = false
): EvtcRecordedRotationAction {
  return {
    start,
    end: start,
    expectedDuration: 0,
    rawSkillId: event.skillId,
    rawName: IGNITE.name,
    canonicalSkillId: IGNITE.skillId,
    canonicalName: IGNITE.name,
    evidence:
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START || event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP
        ? 'animation'
        : 'legacy-activation',
    status: 'instant',
    eventIndex,
    ...(precast ? { precast: true } : {})
  };
}

function igniteActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const ownedEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(({ event }) => event.sourceMasterInstance === ownerInstance && event.skillId === IGNITE_RAW_SKILL_ID);
  const starts = ownedEvents.filter(({ event }) => isOwnedAnimationStart(event, ownerInstance, IGNITE_RAW_SKILL_ID));
  const actions = starts.map(({ event, eventIndex }) => igniteAction(event, eventIndex, event.time));

  // Legacy logs can begin after the familiar animation starts. Its unmatched stop
  // still carries the elapsed duration needed to restore the clipped player input.
  for (const { event, eventIndex } of ownedEvents) {
    const completedStop =
      event.value > 0 &&
      (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP || event.stateChange === EVTC_STATE_CHANGE.NONE) &&
      (event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET);
    if (!completedStop) continue;
    const start = event.time - event.value;
    const matched = starts.some(
      ({ event: candidate }) => candidate.source === event.source && Math.abs(candidate.time - start) <= 150
    );
    if (!matched) actions.push(igniteAction(event, eventIndex, start, true));
  }

  return actions;
}

function openingDragonsToothActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const skill = findRotationSkill(ID.DRAGONS_TOOTH, "Dragon's Tooth", context.catalog, context.profile);
  const duration = quicknessRuntimeDurationMs(skill);
  const strikeOffset = firstStrikePacketOffsetMs(skill, duration, { explicitOnly: true });
  const firstAction = [...actions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  )[0];
  const firstRecordedTooth = actions
    .filter((action) => action.rawSkillId === ID.DRAGONS_TOOTH || action.canonicalSkillId === ID.DRAGONS_TOOTH)
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)[0];
  if (!skill || !(duration > 0) || strikeOffset == null || !firstAction || !firstRecordedTooth) return [];

  const packet = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === ID.DRAGONS_TOOTH &&
        event.time < firstRecordedTooth.start &&
        event.target !== 0n &&
        event.value > 0 &&
        event.buff === 0 &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.stateChange === EVTC_STATE_CHANGE.NONE
    );
  if (!packet) return [];
  const start = packet.event.time - strikeOffset;
  if (Math.abs(start + duration - firstAction.start) > OPENING_SIGNAL_WINDOW_MS) return [];

  // A Dragon's Tooth hit without a matching activation proves the cast began before
  // logging; its explicit packet offset places it directly before the first kept cast.
  return [
    {
      start,
      end: start + duration,
      expectedDuration: duration,
      rawSkillId: ID.DRAGONS_TOOTH,
      rawName: "Dragon's Tooth",
      canonicalSkillId: ID.DRAGONS_TOOTH,
      canonicalName: "Dragon's Tooth",
      evidence: 'effect',
      status: 'completed',
      eventIndex: packet.eventIndex,
      precast: true
    }
  ];
}

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  const numeric = Number(value);
  return Math.max(0, Math.min(maximum, Number.isFinite(numeric) ? Math.floor(numeric) : fallback));
}

// Reconstruction state follows canonical skill IDs so report labels can vary without changing familiar/resource behavior.
function actionSkillId(context: EvtcProfessionReconstructionContext, action: EvtcRecordedRotationAction): number {
  return Number(action.canonicalSkillId ?? skillForAction(context, action)?.id ?? action.rawSkillId);
}

function evokerElement(context: EvtcProfessionReconstructionContext): ElementalistAttunement {
  const configured = String(context.professionConfig?.evokerElement || 'Fire') as ElementalistAttunement;
  return EVOKER_ELEMENTS.has(configured) ? configured : 'Fire';
}

function chargeGrantForAction(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction,
  element: ElementalistAttunement
): EvokerChargeGrant | null {
  if (action.status !== 'completed' && action.status !== 'instant') return null;
  const skill = skillForAction(context, action);
  const gain = skill ? weaponSkillChargeGain({ config: context.professionConfig || {} }, skill, { element }) : 0;
  const fillsCharges = actionSkillId(context, action) === ID.REJUVENATE;
  if (gain <= 0 && !fillsCharges) return null;
  return {
    at: action.end,
    actionStart: action.start,
    eventIndex: action.eventIndex,
    gain,
    fillsCharges
  };
}

function alignCalcifyWithResourceReadiness(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const ordered = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const element = evokerElement(context);
  const grants = ordered
    .map((action) => chargeGrantForAction(context, action, element))
    .filter((grant): grant is EvokerChargeGrant => grant != null)
    .sort((left, right) => left.at - right.at || left.eventIndex - right.eventIndex);
  let charges = boundedInteger(context.professionConfig?.initialEvokerCharges, 6, 6);
  let empowered = boundedInteger(context.professionConfig?.initialEvokerEmpowered, 0, 3);
  let grantIndex = 0;
  const applyGrant = (grant: EvokerChargeGrant, currentCharges: number): number =>
    grant.fillsCharges ? 6 : Math.min(6, currentCharges + grant.gain);

  return ordered.map((action) => {
    while (grantIndex < grants.length && grants[grantIndex].at <= action.start) {
      charges = applyGrant(grants[grantIndex], charges);
      grantIndex += 1;
    }

    const skillId = actionSkillId(context, action);
    if (BASIC_FAMILIARS.has(skillId)) {
      if (empowered >= 3) return action;
      if (charges >= 6) {
        charges = 0;
        empowered = Math.min(3, empowered + 1);
        return action;
      }

      if (skillId !== ID.CALCIFY) return action;

      let prospectiveCharges = charges;
      let prospectiveGrantIndex = grantIndex;
      let readyAt: number | null = null;
      while (prospectiveGrantIndex < grants.length && grants[prospectiveGrantIndex].actionStart < action.start) {
        const grant = grants[prospectiveGrantIndex];
        prospectiveCharges = applyGrant(grant, prospectiveCharges);
        prospectiveGrantIndex += 1;
        if (prospectiveCharges >= 6) {
          readyAt = grant.at;
          break;
        }
      }

      if (readyAt == null) return action;

      // A queued Calcify can begin animating before its parent cast supplies the
      // missing charges. Delay only that case so already-ready casts keep the
      // parent's post-reset charge gain.
      charges = 0;
      empowered = Math.min(3, empowered + 1);
      grantIndex = prospectiveGrantIndex;
      const shift = readyAt - action.start;
      return { ...action, start: readyAt, end: action.end + shift };
    }

    if (FAMILIAR_ELEMENTS.has(skillId) && empowered >= 3) {
      empowered = 0;
    }

    return action;
  });
}

/** Normalizes Evoker-only ArcDPS skill IDs into simulator skill identities. */
export function reconstructEvokerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const normalized = actions.map((action) => {
    const identity = EVOKER_SKILL_ALIASES.get(action.rawSkillId);
    if (!identity) return action;
    return {
      ...action,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name
    };
  });
  const recovered = [...normalized, ...zapActions(context), ...igniteActions(context), ...calcifyActions(context)];
  recovered.push(...openingDragonsToothActions(context, normalized));
  return alignCalcifyWithResourceReadiness(context, recovered).sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
