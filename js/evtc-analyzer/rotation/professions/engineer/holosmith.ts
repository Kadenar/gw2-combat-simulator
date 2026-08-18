import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import { effectWindowMs, findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { inferDetonateActions, kitIdentity, openingDamageSkillNames, PRECOMBAT_BOMBS } from './kits.js';
import {
  canonicalAction,
  castDuration,
  type EngineerActionIdentity,
  findOpeningPrecast,
  normalized,
  selectedSkill,
  skillForAction
} from './shared.js';

const ENGAGE_FORGE = Object.freeze({
  name: 'Engage Photon Forge',
  skillId: 42938
});
const DEACTIVATE_FORGE = Object.freeze({
  name: 'Deactivate Photon Forge',
  skillId: 41123
});
const LASER_DISK = Object.freeze({ name: 'Laser Disk', skillId: 42842 });
const POISON_GRENADE = Object.freeze({
  name: 'Poison Grenade',
  skillId: 5806
});
const FORGE_WEAPON_SET = 3;
const KIT_WEAPON_SET = 2;
const NORMAL_WEAPON_SETS = new Set([4, 5]);
const SWAP_GROUP_WINDOW_MS = 250;
const OVERHEAT_BUFF_ID = 41037;
const OVERHEAT_REPLAY_WINDOW_MS = 2000;
const DIRECT_INPUT_IDS = new Set([42163, 45732]);

function isOverheatTransition(context: EvtcProfessionReconstructionContext, time: number): boolean {
  return context.log.events.some(
    (event) =>
      event.target === context.playerAddress &&
      event.skillId === OVERHEAT_BUFF_ID &&
      event.buff !== 0 &&
      event.buffRemove === 0 &&
      Math.abs(event.time - time) <= 25
  );
}

function preserveOverheatBoundaries(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const overheatTimes = context.log.events
    .filter(
      (event) =>
        event.target === context.playerAddress &&
        event.skillId === OVERHEAT_BUFF_ID &&
        event.buff !== 0 &&
        event.buffRemove === 0
    )
    .map((event) => event.time);
  const preserve = new Set<EvtcRecordedRotationAction>();
  const complete = new Set<EvtcRecordedRotationAction>();
  for (const time of overheatTimes) {
    const nextCast = actions
      .filter(
        (action) =>
          action.end > action.start &&
          action.start >= time &&
          action.start - time <= OVERHEAT_REPLAY_WINDOW_MS &&
          normalized(skillForAction(context, action)?.slot) !== 'weapon_1'
      )
      .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)[0];
    if (nextCast) complete.add(nextCast);
    const spanning = actions
      .filter((action) => action.end > action.start && action.start <= time && action.end >= time)
      .sort((left, right) => right.start - left.start || right.eventIndex - left.eventIndex)[0];
    if (spanning) {
      complete.add(spanning);
      continue;
    }
    const preceding = actions
      .filter((action) => action.end <= time)
      .sort((left, right) => right.end - left.end || right.eventIndex - left.eventIndex)[0];
    if (preceding) preserve.add(preceding);
  }
  return actions.map((action) => {
    if (complete.has(action)) return { ...action, forceCompleteReplay: true };
    if (preserve.has(action)) return { ...action, suppressFollowingWait: false };
    return action;
  });
}

function nextKitAfter(
  context: EvtcProfessionReconstructionContext,
  sorted: readonly EvtcRecordedRotationAction[],
  index: number
): string {
  const nextSwap = sorted.slice(index + 1).find((candidate) => candidate.rawName === 'Swap Weapons');
  const action = sorted
    .slice(index + 1)
    .filter((candidate) => nextSwap == null || candidate.start < nextSwap.start)
    .find((candidate) => Boolean(skillForAction(context, candidate)?.kit));
  return action ? String(skillForAction(context, action)?.kit || '') : '';
}

function normalizeHolosmithTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const result: EvtcRecordedRotationAction[] = [];
  let activeKit: string | null = null;
  let forgeActive = false;

  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    if (action.rawName !== 'Swap Weapons') {
      result.push(action);
      continue;
    }
    const swaps = [action];
    while (
      sorted[index + 1]?.rawName === 'Swap Weapons' &&
      sorted[index + 1].start - action.start <= SWAP_GROUP_WINDOW_MS
    ) {
      swaps.push(sorted[index + 1]);
      index += 1;
    }
    const forgeSwap = swaps.find((swap) => Number(swap.weaponSet) === FORGE_WEAPON_SET);
    if (forgeSwap) {
      result.push(canonicalAction(forgeSwap.eventIndex, forgeSwap.start, ENGAGE_FORGE, 0, 'state-change'));
      forgeActive = true;
      activeKit = null;
      continue;
    }

    const normalSwap = swaps.find((swap) => NORMAL_WEAPON_SETS.has(Number(swap.weaponSet)));
    if (forgeActive && normalSwap) {
      if (!isOverheatTransition(context, normalSwap.start)) {
        result.push(canonicalAction(normalSwap.eventIndex, normalSwap.start, DEACTIVATE_FORGE, 0, 'state-change'));
      }
      forgeActive = false;
    }

    const entersKit = swaps.some((swap) => Number(swap.weaponSet) === KIT_WEAPON_SET);
    const nextKit = entersKit ? nextKitAfter(context, sorted, index) : '';
    if (nextKit) {
      const identity = kitIdentity(context, nextKit, false);
      if (identity) {
        result.push(canonicalAction(swaps.at(-1)!.eventIndex, swaps.at(-1)!.start, identity, 0, 'state-change'));
        activeKit = nextKit;
      }
      continue;
    }
    if (!forgeActive && activeKit && normalSwap) {
      const identity = kitIdentity(context, activeKit, true);
      if (identity) {
        result.push(canonicalAction(normalSwap.eventIndex, normalSwap.start, identity, 0, 'state-change'));
      }
      activeKit = null;
    }
  }
  return result;
}

function inferDirectInputs(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const lastSignal = new Map<number, number>();
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      !DIRECT_INPUT_IDS.has(event.skillId) ||
      event.buff !== 0 ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.value <= 0
    ) {
      return [];
    }
    const skill = findRotationSkill(
      event.skillId,
      context.log.skills.find((candidate) => candidate.id === event.skillId)?.name || '',
      context.catalog,
      context.profile
    );
    if (!skill || typeof skill.id !== 'number') return [];
    const previous = lastSignal.get(event.skillId);
    if (previous != null && event.time - previous < Math.max(1, effectWindowMs(skill))) {
      return [];
    }
    lastSignal.set(event.skillId, event.time);
    return [canonicalAction(eventIndex, event.time, { name: skill.name, skillId: Number(skill.id) }, event.skillId)];
  });
}

function openingActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const opening = findOpeningPrecast(
    context,
    new Map<string, EngineerActionIdentity>([
      [LASER_DISK.name, LASER_DISK],
      [POISON_GRENADE.name, POISON_GRENADE]
    ])
  );
  if (!opening) return [];
  if (opening.rawName === LASER_DISK.name) return [opening];

  const initialNames = openingDamageSkillNames(context, 3500);
  const bombs = selectedSkill(context, 'Bomb Kit')
    ? PRECOMBAT_BOMBS.filter((identity) => initialNames.has(identity.name))
    : [];
  let cursor = opening.start;
  const scheduled: EvtcRecordedRotationAction[] = [];
  for (let index = bombs.length - 1; index >= 0; index -= 1) {
    const identity = bombs[index];
    const duration = castDuration(context, identity);
    cursor -= duration;
    scheduled.unshift({
      ...canonicalAction(opening.eventIndex - 100 - index, cursor, identity, identity.skillId, 'initial-state'),
      end: cursor + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    });
  }
  const bombKit = kitIdentity(context, 'Bomb Kit', false);
  if (bombs.length && bombKit) {
    scheduled.unshift(canonicalAction(opening.eventIndex - 300, cursor, bombKit, bombKit.skillId, 'initial-state'));
  }
  const grenadeKit = kitIdentity(context, 'Grenade Kit', false);
  if (grenadeKit) {
    scheduled.push(
      canonicalAction(opening.eventIndex - 1, opening.start, grenadeKit, grenadeKit.skillId, 'initial-state')
    );
  }
  scheduled.push(opening);
  return scheduled;
}

export function reconstructHolosmithActions(
  context: EvtcProfessionReconstructionContext
): EvtcRecordedRotationAction[] {
  const actions = normalizeHolosmithTransitions(context, context.recordedActions);
  actions.push(...inferDirectInputs(context));
  actions.push(...inferDetonateActions(context));
  actions.push(...openingActions(context));
  return preserveOverheatBoundaries(context, actions);
}
