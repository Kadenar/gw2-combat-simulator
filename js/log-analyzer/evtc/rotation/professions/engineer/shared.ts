import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import { normalized, skillForAction } from '../../effect-packets.js';
import { findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

export interface EngineerActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

const PRECOMBAT_SIGNAL_WINDOW_MS = 1200;

export { normalized, skillForAction };

export function selectedIdentity(
  context: EvtcProfessionReconstructionContext,
  name: string,
  fallbackSkillId: number
): EngineerActionIdentity {
  const selectedIds = new Set((context.selectedSkillIds || []).map(Number).filter(Number.isFinite));
  const selected = context.catalog?.skills.find(
    (skill) =>
      typeof skill.id === 'number' && selectedIds.has(Number(skill.id)) && normalized(skill.name) === normalized(name)
  );

  if (selected && typeof selected.id === 'number') {
    return { name: selected.name, skillId: Number(selected.id) };
  }

  const skill = findRotationSkill(fallbackSkillId, name, context.catalog, context.profile);
  return {
    name: skill?.name || name,
    skillId: typeof skill?.id === 'number' ? Number(skill.id) : fallbackSkillId
  };
}

export function canonicalAction(
  eventIndex: number,
  time: number,
  identity: EngineerActionIdentity,
  rawSkillId: number,
  evidence: EvtcRecordedRotationAction['evidence'] = 'resource-inference'
): EvtcRecordedRotationAction {
  return {
    start: time,
    end: time,
    expectedDuration: 0,
    rawSkillId,
    rawName: identity.name,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence,
    status: 'instant',
    eventIndex
  };
}

export function castDuration(context: EvtcProfessionReconstructionContext, identity: EngineerActionIdentity): number {
  const skill = findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
  return Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
}

export function combatStartTime(context: EvtcProfessionReconstructionContext): number | null {
  const explicit = context.log.events.find(
    (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  )?.time;

  if (explicit != null) return explicit;
  const initial = context.log.events
    .filter((event) => event.target === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL)
    .sort((left, right) => left.time - right.time)[0]?.time;
  return initial ?? null;
}

export function findOpeningPrecast(
  context: EvtcProfessionReconstructionContext,
  identities: ReadonlyMap<string, EngineerActionIdentity>
): EvtcRecordedRotationAction | null {
  const combatStart = combatStartTime(context);

  if (combatStart == null) return null;
  const names = new Map(context.log.skills.map((skill) => [skill.id, skill.name.trim()]));
  const candidate = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(({ event }) => {
      const name = names.get(event.skillId) || '';
      return (
        event.source === context.playerAddress &&
        identities.has(name) &&
        (event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET) &&
        (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP || event.stateChange === EVTC_STATE_CHANGE.NONE) &&
        event.value > 0 &&
        event.time - event.value < combatStart &&
        event.time <= combatStart + PRECOMBAT_SIGNAL_WINDOW_MS
      );
    })
    .sort((left, right) => left.event.time - right.event.time)[0];

  if (!candidate) return null;
  const name = names.get(candidate.event.skillId)!;
  const fallback = identities.get(name)!;
  const identity = selectedIdentity(context, fallback.name, fallback.skillId);
  const start = candidate.event.time - candidate.event.value;
  return {
    ...canonicalAction(candidate.eventIndex, start, identity, candidate.event.skillId, 'animation'),
    end: candidate.event.time,
    expectedDuration: Math.max(candidate.event.value, candidate.event.buffDamage),
    status: 'completed',
    precast: true
  };
}

export function selectedSkill(context: EvtcProfessionReconstructionContext, name: string): boolean {
  return (
    !context.selectedSkillNames?.length ||
    context.selectedSkillNames.some((selected) => normalized(selected) === normalized(name))
  );
}

function encounterEndTime(context: EvtcProfessionReconstructionContext): number | null {
  const targets = new Set(
    context.log.agents
      .filter((agent) => agent.profession === context.log.header.encounterId)
      .map((agent) => agent.address)
  );
  const times = context.log.events
    .filter(
      (event) =>
        targets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}

export function finalizeEngineerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context);
  const inEncounter = encounterEnd == null ? [...actions] : actions.filter((action) => action.start < encounterEnd);
  return inEncounter.map((action) => ({
    ...action,
    suppressFollowingWait: action.suppressFollowingWait ?? !(action.precast === true && action.rawName === 'Throw Mine')
  }));
}
