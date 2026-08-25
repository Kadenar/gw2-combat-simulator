import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import { effectWindowMs, findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import {
  inferDetonateActions,
  kitIdentity,
  normalizeKitTransitions,
  openingDamageSkillNames,
  PRECOMBAT_BOMBS
} from './kits.js';
import {
  canonicalAction,
  castDuration,
  type EngineerActionIdentity,
  findOpeningPrecast,
  normalized,
  selectedIdentity,
  selectedSkill,
  skillForAction
} from './shared.js';

const THROW_MINE = Object.freeze({ name: 'Throw Mine', skillId: 6161 });
const EVOLVE = Object.freeze({ name: 'Evolve', skillId: 76642 });
const FLUX_STATE = Object.freeze({ name: 'Flux State', skillId: 76993 });
const THUNDERCLAP = Object.freeze({ name: 'Thunderclap', skillId: 30713 });
const GALVANIC_BOMB = PRECOMBAT_BOMBS.find((identity) => identity.name === 'Galvanic Bomb')!;
const EVOLVED_BUFF = 77008;
const EVOLVE_EFFECT_DELAY_MS = 520;
const PRECAST_MINE_WAIT_MS = 5000;
const PRECAST_MINE_DURATION_MS = 400;
const SIGNAL_WINDOW_MS = 150;

const AMALGAM_PROTOCOL_NAMES = new Set([
  'Defensive Protocol: Cleanse',
  'Defensive Protocol: Protect',
  'Defensive Protocol: Thorns',
  'Offensive Protocol: Demolish',
  'Offensive Protocol: Obliterate',
  'Offensive Protocol: Pierce',
  'Offensive Protocol: Shred'
]);
const THORNS_SIGNAL_IDS = new Set([76640, 77104, 77163]);

function coalesceCompositeAnimations(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const result: EvtcRecordedRotationAction[] = [];
  const consumed = new Set<EvtcRecordedRotationAction>();
  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    if (consumed.has(action)) continue;
    const followUp = sorted
      .slice(index + 1)
      .find(
        (candidate) =>
          !consumed.has(candidate) &&
          candidate.start >= action.end &&
          candidate.start - action.end <= SIGNAL_WINDOW_MS &&
          ((action.rawName === 'Offensive Protocol: Demolish' && candidate.rawSkillId === 77013) ||
            (action.rawName === 'Plasmatic State' && candidate.rawSkillId === 77307))
      );
    const composite =
      (action.rawName === 'Offensive Protocol: Demolish' && followUp?.rawSkillId === 77013) ||
      (action.rawName === 'Plasmatic State' && followUp?.rawSkillId === 77307);
    if (!composite || followUp.rawName !== action.rawName || followUp.start - action.end > SIGNAL_WINDOW_MS) {
      result.push(action);
      continue;
    }

    const identity = selectedIdentity(context, action.rawName, action.rawSkillId);
    result.push({
      ...action,
      end: Math.max(action.end, followUp.end),
      expectedDuration: Math.max(action.end, followUp.end) - action.start,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name,
      status: followUp.status
    });
    consumed.add(followUp);
  }

  return result;
}

function normalizeAmalgamIdentities(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (!AMALGAM_PROTOCOL_NAMES.has(action.rawName) && action.rawName !== EVOLVE.name) {
      return action;
    }

    const identity = selectedIdentity(
      context,
      action.rawName,
      action.rawName === EVOLVE.name ? EVOLVE.skillId : action.rawSkillId
    );
    return {
      ...action,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name
    };
  });
}

function inferThornsActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const identity = selectedIdentity(context, 'Defensive Protocol: Thorns', 77104);
  const skill = findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
  const windowMs = skill ? effectWindowMs(skill) : 100;
  let previous = Number.NEGATIVE_INFINITY;
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      !THORNS_SIGNAL_IDS.has(event.skillId) ||
      event.buff !== 0 ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.value <= 0 ||
      event.time - previous < windowMs
    ) {
      return [];
    }

    previous = event.time;
    return [canonicalAction(eventIndex, event.time, identity, event.skillId)];
  });
}

function initialEvolveAction(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction | null {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === EVOLVED_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.value > 0 &&
        event.buffDamage >= event.value
    );
  if (!initial) return null;

  const identity = selectedIdentity(context, EVOLVE.name, EVOLVE.skillId);
  const duration = castDuration(context, identity);
  // BUFF_INITIAL stores Evolved's full and remaining durations. Backtrack its
  // elapsed duration and effect delay to recover an Evolve cast hidden before logging began.
  const elapsed = initial.event.buffDamage - initial.event.value;
  const start = initial.event.time - elapsed - EVOLVE_EFFECT_DELAY_MS;
  return {
    ...canonicalAction(initial.eventIndex, start, identity, identity.skillId, 'initial-state'),
    end: start + duration,
    expectedDuration: duration,
    status: 'completed',
    precast: true
  };
}

function openingPrecastActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const initialEvolve = initialEvolveAction(context);
  // Rifle openings expose the truncated Galvanic Bomb animation instead of a
  // weapon cast, so use that boundary to rebuild the otherwise missing setup.
  const opening = findOpeningPrecast(
    context,
    new Map<string, EngineerActionIdentity>([
      [THUNDERCLAP.name, THUNDERCLAP],
      [FLUX_STATE.name, FLUX_STATE],
      [GALVANIC_BOMB.name, GALVANIC_BOMB]
    ])
  );
  if (!opening) return initialEvolve ? [initialEvolve] : [];
  const openingIsBomb = PRECOMBAT_BOMBS.some((identity) => identity.name === opening.rawName);
  const initialBombNames = openingDamageSkillNames(context);
  const bombs = selectedSkill(context, 'Bomb Kit')
    ? PRECOMBAT_BOMBS.filter((identity) => initialBombNames.has(identity.name))
    : [];
  const ordered: Array<
    EngineerActionIdentity & {
      readonly evidence: EvtcRecordedRotationAction['evidence'];
    }
  > = [];
  for (const bomb of bombs) {
    if (bomb.name === 'Fire Bomb' && initialEvolve) {
      ordered.push({ ...EVOLVE, evidence: 'initial-state' });
    }

    if (bomb.name !== opening.rawName) {
      ordered.push({ ...bomb, evidence: 'initial-state' });
    }
  }

  if (!bombs.length && initialEvolve) {
    ordered.push({ ...EVOLVE, evidence: 'initial-state' });
  }

  let cursor = opening.start;
  const scheduled: EvtcRecordedRotationAction[] = [];
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const identity = ordered[index];
    const duration = castDuration(context, identity);
    cursor -= duration;
    scheduled.unshift({
      ...canonicalAction(opening.eventIndex - 100 - index, cursor, identity, identity.skillId, identity.evidence),
      end: cursor + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    });
  }

  if (bombs.length) {
    const equip = kitIdentity(context, 'Bomb Kit', false);
    const stow = kitIdentity(context, 'Bomb Kit', true);
    if (equip) {
      scheduled.unshift(canonicalAction(opening.eventIndex - 300, cursor, equip, equip.skillId, 'initial-state'));
    }

    if (stow) {
      const openingSkill = skillForAction(context, opening);
      const stowTime = openingIsBomb
        ? opening.end
        : normalized(openingSkill?.type) === 'weapon'
          ? opening.start
          : opening.end;
      scheduled.push(canonicalAction(opening.eventIndex - 1, stowTime, stow, stow.skillId, 'initial-state'));
    }

    if (selectedSkill(context, THROW_MINE.name) && initialBombNames.has(THROW_MINE.name)) {
      const mineEnd = cursor - PRECAST_MINE_WAIT_MS;
      const mineStart = mineEnd - PRECAST_MINE_DURATION_MS;
      scheduled.unshift({
        ...canonicalAction(opening.eventIndex - 400, mineStart, THROW_MINE, THROW_MINE.skillId, 'initial-state'),
        end: mineEnd,
        expectedDuration: PRECAST_MINE_DURATION_MS,
        status: 'completed',
        precast: true
      });
    }
  }

  scheduled.push(opening);
  return scheduled;
}

export function reconstructAmalgamActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  let actions = coalesceCompositeAnimations(context, context.recordedActions);
  actions = normalizeAmalgamIdentities(context, actions);
  actions = normalizeKitTransitions(context, actions);
  actions.push(...inferThornsActions(context));
  actions.push(...inferDetonateActions(context));
  actions.push(...openingPrecastActions(context));
  return actions;
}
