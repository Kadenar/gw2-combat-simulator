import { reconstructAmalgamActions } from './engineer/amalgam.js';
import { removeUncommittedEngineerAutoattacks } from './engineer/autoattacks.js';
import { reconstructHolosmithActions } from './engineer/holosmith.js';
import {
  inferDetonateActions,
  kitIdentity,
  normalizeKitTransitions,
  openingDamageSkillNames,
  PRECOMBAT_BOMBS
} from './engineer/kits.js';
import { reconstructMechanistActions } from './engineer/mechanist.js';
import { reconstructScrapperActions } from './engineer/scrapper.js';
import {
  canonicalAction,
  castDuration,
  combatStartTime,
  finalizeEngineerActions,
  findOpeningPrecast,
  selectedIdentity,
  selectedSkill,
  type EngineerActionIdentity
} from './engineer/shared.js';
import type {
  EvtcProfessionActionReconstructor,
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from './types.js';

const specializationReconstructors: ReadonlyMap<string, EvtcProfessionActionReconstructor> = new Map([
  ['amalgam', reconstructAmalgamActions],
  ['holosmith', reconstructHolosmithActions],
  ['mechanist', reconstructMechanistActions],
  ['scrapper', reconstructScrapperActions]
]);

const DODGE = Object.freeze({ name: 'Dodge', skillId: -5 });
const MINE_FIELD = Object.freeze({ name: 'Mine Field', skillId: 6164 });
const PRECAST_MINE_WAIT_MS = 12_000;

function completedPrecast(
  context: EvtcProfessionReconstructionContext,
  identity: EngineerActionIdentity,
  start: number,
  eventIndex: number
): EvtcRecordedRotationAction {
  const duration = castDuration(context, identity);
  return {
    ...canonicalAction(eventIndex, start, identity, identity.skillId, 'initial-state'),
    end: start + duration,
    expectedDuration: duration,
    status: 'completed',
    precast: true
  };
}

function reconstructCoreOpening(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (!selectedSkill(context, 'Throw Mine') || !selectedSkill(context, 'Bomb Kit')) return [];
  const opening = findOpeningPrecast(context, new Map(PRECOMBAT_BOMBS.map((identity) => [identity.name, identity])));
  if (!opening) return [];
  const signals = openingDamageSkillNames(context, 3500);
  if (!signals.has('Throw Mine') || !signals.has(MINE_FIELD.name)) return [];

  // Opening damage is the only EVTC evidence for setup completed before logging began.
  const bombKit = kitIdentity(context, 'Bomb Kit', false);
  if (!bombKit) return [];
  const setup = [
    DODGE,
    DODGE,
    MINE_FIELD,
    bombKit,
    ...PRECOMBAT_BOMBS.filter((identity) => identity.name !== opening.rawName && signals.has(identity.name))
  ];
  const setupDuration = setup.reduce((total, identity) => total + castDuration(context, identity), 0);
  let cursor = opening.start - setupDuration;
  const throwMine = selectedIdentity(context, 'Throw Mine', 6161);
  const throwDuration = castDuration(context, throwMine);
  const actions = [
    completedPrecast(context, throwMine, cursor - PRECAST_MINE_WAIT_MS - throwDuration, opening.eventIndex - 1000)
  ];
  setup.forEach((identity, index) => {
    const action = completedPrecast(context, identity, cursor, opening.eventIndex - 900 + index);
    actions.push(action);
    cursor = action.end;
  });
  actions.push(opening);

  const combatStart = combatStartTime(context);
  const stow = kitIdentity(context, 'Bomb Kit', true);
  const swap = context.recordedActions.find(
    (action) =>
      action.rawName === 'Swap Weapons' &&
      combatStart != null &&
      action.start >= combatStart &&
      action.start <= opening.end
  );
  if (stow && swap) actions.push(canonicalAction(swap.eventIndex, swap.start, stow, 0, 'state-change'));
  return actions;
}

function reconstructCoreEngineerActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions = normalizeKitTransitions(context, context.recordedActions);
  actions.push(...reconstructCoreOpening(context));
  actions.push(...inferDetonateActions(context));
  return actions;
}

export function reconstructEngineerProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions =
    specializationReconstructors.get(context.profile.specializationId)?.(context) ||
    reconstructCoreEngineerActions(context);
  return finalizeEngineerActions(context, removeUncommittedEngineerAutoattacks(context, actions));
}
