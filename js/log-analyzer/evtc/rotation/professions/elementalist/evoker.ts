import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '../../../types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../../../professions/elementalist/data/ids.js';
import type { ElementalistAttunement } from '../../../../../professions/elementalist/core/state.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '../../../../../professions/elementalist/specializations/evoker/constants.js';
import { weaponSkillChargeGain } from '../../../../../professions/elementalist/specializations/evoker/resources.js';
import { skillForAction } from '../../effect-packets.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

const EVOKER_SKILL_ALIASES = new Map([
  [76925, { name: 'Calcify', skillId: ID.CALCIFY }],
  [76707, { name: 'Seismic Impact', skillId: ID.SEISMIC_IMPACT }],
  [77247, { name: "Toad's Fortitude", skillId: ID.TOADS_FORTITUDE }]
]);
const CALCIFY_RAW_SKILL_ID = 76925;
const CALCIFY = Object.freeze({ name: 'Calcify', skillId: ID.CALCIFY });
const EVOKER_ELEMENTS = new Set<ElementalistAttunement>(['Fire', 'Water', 'Air', 'Earth']);

interface EvokerChargeGrant {
  readonly at: number;
  readonly actionStart: number;
  readonly eventIndex: number;
  readonly gain: number;
  readonly fillsCharges: boolean;
}

function playerInstance(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find((event) => event.source === context.playerAddress && event.sourceInstance > 0)
      ?.sourceInstance ?? null
  );
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

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  const numeric = Number(value);
  return Math.max(0, Math.min(maximum, Number.isFinite(numeric) ? Math.floor(numeric) : fallback));
}

function actionName(action: EvtcRecordedRotationAction): string {
  return action.canonicalName ?? action.rawName;
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
  const name = actionName(action);
  const skill = skillForAction(context, action);
  const gain = skill ? weaponSkillChargeGain({ config: context.professionConfig || {} }, skill, { element }) : 0;
  const fillsCharges = name === 'Rejuvenate';
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

    const name = actionName(action);
    if (BASIC_FAMILIARS.has(name)) {
      if (empowered >= 3) return action;
      if (charges >= 6) {
        charges = 0;
        empowered = Math.min(3, empowered + 1);
        return action;
      }

      if (name !== CALCIFY.name) return action;

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

    if (FAMILIAR_ELEMENTS[name] && empowered >= 3) {
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
  return alignCalcifyWithResourceReadiness(context, [...normalized, ...calcifyActions(context)]).sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
