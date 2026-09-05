import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { weaponSkillChargeGain } from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { firstStrikePacketOffsetMs, skillForAction } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { findRotationSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
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

interface EvokerChargeGrant {
  readonly at: number;
  readonly actionStart: number;
  readonly eventIndex: number;
  readonly gain: number;
  readonly fillsCharges: boolean;
}

function isAnimationStart(event: ParsedEvtcEvent): boolean {
  return (
    event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
    (event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS))
  );
}

function calcifyEffectCommitted(
  context: EvtcProfessionReconstructionContext,
  rawSkillId: number,
  start: number,
  end: number
): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === rawSkillId &&
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
        event.skillId === start.skillId &&
        event.time > start.time &&
        Math.abs(event.time - start.time - event.value) <= 150
    ) ?? null
  );
}

function calcifyAction(event: ParsedEvtcEvent, eventIndex: number, start: number): EvtcRecordedRotationAction {
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
    eventIndex
  };
}

function calcifyActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const ownedEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(({ event }) => event.sourceMasterInstance === ownerInstance && event.skillId === CALCIFY_RAW_SKILL_ID);
  const starts = ownedEvents.filter(({ event }) => isAnimationStart(event));
  const stops = ownedEvents.filter(
    ({ event }) =>
      event.value > 0 &&
      (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP ||
        (event.stateChange === EVTC_STATE_CHANGE.NONE &&
          (event.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
            event.activation === EVTC_ACTIVATION.CANCEL_CANCEL ||
            event.activation === EVTC_ACTIVATION.RESET)))
  );
  const matchedStopIndexes = new Set<number>();
  const actions = starts.flatMap(({ event, eventIndex }) => {
    const stop = matchingCalcifyStop(event, stops, matchedStopIndexes);
    if (stop) matchedStopIndexes.add(stop.eventIndex);
    // Seismic Impact can cancel the familiar's visual animation after Calcify
    // committed; keep that input, but do not replay an uncommitted cancellation.
    if (
      stop?.event.activation === EVTC_ACTIVATION.CANCEL_CANCEL &&
      !calcifyEffectCommitted(context, event.skillId, event.time, stop.event.time)
    ) {
      return [];
    }

    return [calcifyAction(event, eventIndex, event.time)];
  });

  return actions;
}

function zapActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const skill = findRotationSkill(ZAP.skillId, ZAP.name, context.catalog, context.profile);
  const strikeOffset = firstStrikePacketOffsetMs(skill) ?? 0;
  const directEffects = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target !== 0n &&
        event.skillId === ZAP_RAW_SKILL_ID &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0
    );
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];

  // Direct player damage is one-to-one with Zap inputs; familiar animations overlap
  // and are only a fallback when the log contains no direct Zap effects at all.
  const signals = directEffects.length
    ? directEffects.map(({ event, eventIndex }) => ({
        event,
        eventIndex,
        start: event.time - strikeOffset,
        evidence: 'effect' as const
      }))
    : context.log.events.flatMap((event, eventIndex) =>
        event.sourceMasterInstance === ownerInstance && event.skillId === ZAP_RAW_SKILL_ID && isAnimationStart(event)
          ? [
              {
                event,
                eventIndex,
                start: event.time,
                evidence:
                  event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START
                    ? ('animation' as const)
                    : ('legacy-activation' as const)
              }
            ]
          : []
      );
  return signals.map(({ event, eventIndex, start, evidence }) => ({
    start,
    end: start,
    expectedDuration: 0,
    rawSkillId: event.skillId,
    rawName: ZAP.name,
    canonicalSkillId: ZAP.skillId,
    canonicalName: ZAP.name,
    evidence,
    status: 'instant',
    eventIndex
  }));
}

function isOwnedAnimationStart(event: ParsedEvtcEvent, ownerInstance: number, skillId: number): boolean {
  return event.sourceMasterInstance === ownerInstance && event.skillId === skillId && isAnimationStart(event);
}

function igniteAction(event: ParsedEvtcEvent, eventIndex: number, start: number): EvtcRecordedRotationAction {
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
    eventIndex
  };
}

function igniteActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const ownedEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(({ event }) => event.sourceMasterInstance === ownerInstance && event.skillId === IGNITE_RAW_SKILL_ID);
  const starts = ownedEvents.filter(({ event }) => isOwnedAnimationStart(event, ownerInstance, IGNITE_RAW_SKILL_ID));
  return starts.map(({ event, eventIndex }) => igniteAction(event, eventIndex, event.time));
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

function alignBasicFamiliarWithResourceReadiness(
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

      // A queued basic familiar can animate before its parent weapon cast supplies
      // the missing charges; replay it at that grant so the subsequent reset is ordered correctly.
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
  return alignBasicFamiliarWithResourceReadiness(context, recovered).sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
