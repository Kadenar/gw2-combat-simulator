import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcRotationBuffTransition } from '../../profiles.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { ownedPetAddresses } from './pets.js';
import { directAction, playerInstance, rangerSkill, rawSkillName, type RangerActionIdentity } from './shared.js';

const UNLEASH_RANGER_BUFF = 63317;
const UNLEASH_RANGER = Object.freeze({
  name: 'Unleash Ranger',
  skillId: 63147
});
const UNLEASH_PET = Object.freeze({ name: 'Unleash Pet', skillId: 63344 });
const UNLEASHED_OVERBEARING_SMASH = Object.freeze({
  name: 'Unleashed Overbearing Smash',
  skillId: 63197
});
const OVERBEARING_FOLLOW_UP_RAW_ID = 63224;
const EXPLODING_SPORES = Object.freeze({
  name: 'Exploding Spores',
  skillId: 63157
});
const STRENGTH_OF_THE_PACK = Object.freeze({
  name: '"Strength of the Pack!"',
  skillId: 12516
});
const WE_HEAL_AS_ONE = Object.freeze({
  name: '"We Heal As One!"',
  skillId: 31914
});
const PET_SIGNAL_CLUSTER_MS = 2500;
const PET_TRANSITION_WINDOW_MS = 2000;
const INITIAL_SPORE_SIGNAL_WINDOW_MS = 2000;

interface UnleashedPetSignal {
  readonly rawSkillId: number;
  readonly identity: RangerActionIdentity;
  readonly order: number;
}

const UNLEASHED_PET_SIGNALS: readonly UnleashedPetSignal[] = [
  {
    rawSkillId: 63136,
    identity: { name: 'Enveloping Haze', skillId: 63094 },
    order: 0
  },
  {
    rawSkillId: 63082,
    identity: { name: 'Venomous Outburst', skillId: 63209 },
    order: 1
  },
  {
    rawSkillId: 63296,
    identity: { name: 'Rending Vines', skillId: 63258 },
    order: 2
  }
];

const signalsByRawId = new Map(UNLEASHED_PET_SIGNALS.map((signal) => [signal.rawSkillId, signal]));

function isAction(action: EvtcRecordedRotationAction, skillId: number): boolean {
  return action.rawSkillId === skillId || action.canonicalSkillId === skillId;
}

export const UNTAMED_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: UNLEASH_RANGER_BUFF,
    gain: UNLEASH_RANGER,
    loss: UNLEASH_PET,
    suppressWeaponSwap: false
  }
];

function coalesceOverbearingSmash(actions: readonly EvtcRecordedRotationAction[]): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const absorbed = new Set<EvtcRecordedRotationAction>();
  return sorted.flatMap((action) => {
    if (absorbed.has(action)) return [];
    if (action.rawSkillId !== UNLEASHED_OVERBEARING_SMASH.skillId) {
      return [action];
    }
    const followUp = sorted.find(
      (candidate) =>
        !absorbed.has(candidate) &&
        candidate.rawSkillId === OVERBEARING_FOLLOW_UP_RAW_ID &&
        candidate.start >= action.end - 50 &&
        candidate.start - action.end <= 150
    );
    if (!followUp) return [action];
    absorbed.add(followUp);
    return [
      {
        ...action,
        end: Math.max(action.end, followUp.end),
        expectedDuration:
          Math.max(0, Number(action.expectedDuration || 0)) + Math.max(0, Number(followUp.expectedDuration || 0)),
        canonicalSkillId: UNLEASHED_OVERBEARING_SMASH.skillId,
        canonicalName: UNLEASHED_OVERBEARING_SMASH.name,
        status:
          followUp.status === 'interrupted'
            ? 'interrupted'
            : action.status === 'interrupted'
              ? 'interrupted'
              : 'completed'
      }
    ];
  });
}

function nearestUnleashRanger(
  transitions: readonly EvtcRecordedRotationAction[],
  time: number
): EvtcRecordedRotationAction | null {
  const closest = [...transitions].sort((left, right) => Math.abs(left.start - time) - Math.abs(right.start - time))[0];
  return closest && Math.abs(closest.start - time) <= PET_TRANSITION_WINDOW_MS ? closest : null;
}

function unleashedPetActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const pets = ownedPetAddresses(context, ownerInstance);
  const transitions = actions.filter((action) => isAction(action, UNLEASH_RANGER.skillId));
  const lastSignalBySkill = new Map<number, number>();
  return context.log.events.flatMap((event, eventIndex) => {
    const signal = signalsByRawId.get(event.skillId);
    if (
      !signal ||
      !pets.has(event.source) ||
      event.sourceMasterInstance !== ownerInstance ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.buff !== 0 ||
      event.value <= 0
    ) {
      return [];
    }
    const previous = lastSignalBySkill.get(event.skillId);
    if (previous != null && event.time - previous <= PET_SIGNAL_CLUSTER_MS) {
      lastSignalBySkill.set(event.skillId, event.time);
      return [];
    }
    lastSignalBySkill.set(event.skillId, event.time);
    const transition = nearestUnleashRanger(transitions, event.time);
    const start = transition ? transition.start - (UNLEASHED_PET_SIGNALS.length - signal.order) : event.time;
    return [
      directAction(eventIndex, start, event.skillId, rawSkillName(context, event.skillId), signal.identity, 'effect')
    ];
  });
}

function initialExplodingSpores(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const firstRecorded = actions
    .filter((action) => isAction(action, EXPLODING_SPORES.skillId))
    .sort((left, right) => left.start - right.start)[0];
  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === EXPLODING_SPORES.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0 &&
        (firstRecorded == null || event.time < firstRecorded.start)
    );
  if (!signal) return [];
  const transition = actions
    .filter(
      (action) =>
        isAction(action, UNLEASH_RANGER.skillId) &&
        action.start <= signal.event.time &&
        signal.event.time - action.start <= INITIAL_SPORE_SIGNAL_WINDOW_MS
    )
    .sort((left, right) => right.start - left.start)[0];
  return [
    directAction(
      signal.eventIndex,
      transition ? transition.start + 1 : signal.event.time,
      signal.event.skillId,
      rawSkillName(context, signal.event.skillId),
      EXPLODING_SPORES,
      'effect'
    )
  ];
}

function selectedSkill(context: EvtcProfessionReconstructionContext, identity: RangerActionIdentity): boolean {
  const normalized = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return context.selectedSkillNames?.some((name) => normalized(name) === normalized(identity.name)) === true;
}

function initialUtilityPrecasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  if (!context.selectedSkillNames?.length || !actions.length) return [];
  const initialBuffs = context.log.events.filter(
    (event) => event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL && event.buff !== 0
  );
  const hasPlayerBoon = initialBuffs.some(
    (event) =>
      event.source === context.playerAddress &&
      (event.target === context.playerAddress || event.sourceMasterInstance === playerInstance(context))
  );
  const identities = [
    ...(selectedSkill(context, STRENGTH_OF_THE_PACK) && hasPlayerBoon ? [STRENGTH_OF_THE_PACK] : []),
    ...(selectedSkill(context, WE_HEAL_AS_ONE) && hasPlayerBoon ? [WE_HEAL_AS_ONE] : [])
  ];
  const anchor = Math.min(...actions.map((action) => action.start));
  return identities.map((identity, index) =>
    directAction(
      -3000 + index,
      anchor - identities.length + index,
      identity.skillId,
      identity.name,
      identity,
      'initial-state',
      { precast: true }
    )
  );
}

export function reconstructUntamedActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  let actions = coalesceOverbearingSmash(recordedActions);
  actions = [...actions, ...unleashedPetActions(context, actions), ...initialExplodingSpores(context, actions)];
  return [...actions, ...initialUtilityPrecasts(context, actions)].map((action) => {
    if (action.canonicalSkillId !== UNLEASHED_OVERBEARING_SMASH.skillId) {
      return action;
    }
    const skill = rangerSkill(context, UNLEASHED_OVERBEARING_SMASH.skillId, UNLEASHED_OVERBEARING_SMASH.name);
    return skill
      ? {
          ...action,
          canonicalSkillId: Number(skill.id),
          canonicalName: skill.name
        }
      : action;
  });
}
