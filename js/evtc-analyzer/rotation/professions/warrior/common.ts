import type { Skill } from '../../../../platform/engine/types.js';
import { EVTC_STATE_CHANGE } from '../../../types.js';
import { createStrikePacketMatcher, firstStrikePacketOffsetMs } from '../../effect-packets.js';
import { findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { playerInitialBuff, sequentialInitialActions, type WarriorActionIdentity } from './shared.js';

export const WARRIOR_CORE_ACTIONS = Object.freeze({
  healingSignet: Object.freeze({ name: 'Healing Signet', skillId: 14389 }),
  mending: Object.freeze({ name: 'Mending', skillId: 14401 }),
  signetOfRage: Object.freeze({ name: 'Signet of Rage', skillId: 14355 }),
  signetOfMight: Object.freeze({ name: 'Signet of Might', skillId: 14404 }),
  signetOfFury: Object.freeze({ name: 'Signet of Fury', skillId: 14410 }),
  kick: Object.freeze({ name: 'Kick', skillId: 14502 }),
  bullsCharge: Object.freeze({ name: "Bull's Charge", skillId: 14516 })
});

export type WarriorCorePrecastId = keyof typeof WARRIOR_CORE_ACTIONS;

const RESISTANCE_BUFF = 26980;
const SWIFTNESS_BUFF = 719;
const SIGNET_OF_MIGHT_ACTIVE_BUFF = 36781;
const SIGNET_OF_FURY_ACTIVE_BUFF = 51664;
const PEAK_PERFORMANCE_BUFF = 46853;

const CORE_PRECAST_BUFFS: Readonly<Record<WarriorCorePrecastId, number>> = {
  healingSignet: RESISTANCE_BUFF,
  mending: PEAK_PERFORMANCE_BUFF,
  signetOfRage: SWIFTNESS_BUFF,
  signetOfMight: SIGNET_OF_MIGHT_ACTIVE_BUFF,
  signetOfFury: SIGNET_OF_FURY_ACTIVE_BUFF,
  kick: PEAK_PERFORMANCE_BUFF,
  bullsCharge: PEAK_PERFORMANCE_BUFF
};

const COMPOSITE_FOLLOW_UP_ANIMATION_IDS = new Set([
  14493, // Rush impact animation
  80224 // Rend follow-up animation
]);

export function detectedWarriorCorePrecast(
  context: EvtcProfessionReconstructionContext,
  id: WarriorCorePrecastId
): boolean {
  return playerInitialBuff(context, CORE_PRECAST_BUFFS[id]);
}

export function detectedWarriorCorePrecastIdentity(
  context: EvtcProfessionReconstructionContext,
  id: WarriorCorePrecastId
): WarriorActionIdentity | null {
  return detectedWarriorCorePrecast(context, id) ? WARRIOR_CORE_ACTIONS[id] : null;
}

export function sequentialWarriorCorePrecasts(
  context: EvtcProfessionReconstructionContext,
  ids: readonly WarriorCorePrecastId[],
  end: number,
  eventIndexBase: number
): EvtcRecordedRotationAction[] {
  return sequentialInitialActions(
    context,
    ids.flatMap((id) => {
      const identity = detectedWarriorCorePrecastIdentity(context, id);
      return identity ? [identity] : [];
    }),
    end,
    eventIndexBase
  );
}

function runtimeCastDurationMs(skill: Skill): number {
  return Math.max(0, Number(skill.dualWieldCastTimeMs || skill.quicknessCastTimeMs || skill.castTimeMs || 0));
}

export function normalizeWarriorCommonActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const normalized: EvtcRecordedRotationAction[] = [];
  const validatePackets = createStrikePacketMatcher(context, {
    toleranceMs: 150,
    runtimeDurationMs: runtimeCastDurationMs
  });
  const absorbAnimation = (action: EvtcRecordedRotationAction): void => {
    let previousIndex = normalized.length - 1;
    while (previousIndex >= 0 && normalized[previousIndex].end <= normalized[previousIndex].start) {
      previousIndex -= 1;
    }
    if (previousIndex < 0) return;
    const previous = normalized[previousIndex];
    normalized[previousIndex] = {
      ...previous,
      end: Math.max(previous.end, action.end)
    };
  };

  for (const action of actions) {
    if (COMPOSITE_FOLLOW_UP_ANIMATION_IDS.has(action.rawSkillId)) {
      absorbAnimation(action);
      continue;
    }

    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile
    );
    const autoattack =
      String(skill?.type || '').toLowerCase() === 'weapon' && String(skill?.slot || '').toLowerCase() === 'weapon_1';
    const commitMs = skill ? firstStrikePacketOffsetMs(skill, runtimeCastDurationMs(skill)) : null;
    const duration = Math.max(0, action.end - action.start);
    const committedStrike = skill != null && commitMs != null && validatePackets(action).anyObserved;
    if (autoattack && !committedStrike && commitMs != null && duration < commitMs) {
      absorbAnimation(action);
      continue;
    }

    if (action.status === 'interrupted' && commitMs != null && (duration >= commitMs || committedStrike)) {
      const replayDuration = Math.max(duration, skill ? runtimeCastDurationMs(skill) : 0);
      normalized.push({
        ...action,
        end: action.start + replayDuration,
        status: 'completed' as const
      });
      continue;
    }
    normalized.push(action);
  }
  return normalized;
}

export function removePostEncounterWarriorActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const targets = new Set(
    context.log.agents
      .filter((agent) => agent.profession === context.log.header.encounterId)
      .map((agent) => agent.address)
  );
  const encounterEnd = context.log.events
    .filter(
      (event) =>
        targets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
    )
    .map((event) => event.time)
    .sort((left, right) => left - right)[0];
  return encounterEnd == null ? [...actions] : actions.filter((action) => action.start < encounterEnd);
}
