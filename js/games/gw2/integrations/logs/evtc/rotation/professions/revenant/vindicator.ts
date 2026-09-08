import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  committedActionsFromStrikePackets,
  EFFECT_PACKET_TOLERANCE_MS,
  isRecordedAutoattack,
  skillForAction
} from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { reconstructCommonRevenantActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/common.js';
import {
  VINDICATOR_AIRBORNE_MS,
  VINDICATOR_JUMP_SKILL
} from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';

const DEATH_DROP_IDS = new Set([62693, 62730]);

function deathDrop(action: EvtcRecordedRotationAction): boolean {
  return (
    DEATH_DROP_IDS.has(Number(action.rawSkillId)) ||
    DEATH_DROP_IDS.has(Number(action.canonicalSkillId)) ||
    normalized(action.rawName) === 'death drop' ||
    normalized(action.canonicalName) === 'death drop'
  );
}

function dodge(action: EvtcRecordedRotationAction, context: EvtcProfessionReconstructionContext): boolean {
  return (
    action.rawSkillId === 23275 ||
    Number(action.canonicalSkillId) === Number(context.profile.dodge.skillId) ||
    normalized(action.rawName) === normalized(context.profile.dodge.name) ||
    normalized(action.canonicalName) === normalized(context.profile.dodge.name)
  );
}

/** Pairs takeoff and landing into one jump, inferring omitted takeoffs from the fixed airborne duration. */
export function reconstructVindicatorActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const actions = reconstructCommonRevenantActions(context);
  const committedStrikes = committedActionsFromStrikePackets(context, actions);
  const hasDeathDrop = actions.some(deathDrop);
  const airborneAutos = new Set<EvtcRecordedRotationAction>();
  const jumps = new Map<EvtcRecordedRotationAction, EvtcRecordedRotationAction>();
  for (const landing of actions.filter(deathDrop)) {
    // The input precedes the landing animation by 600 ms; damage evidence distinguishes the bug from canceled autos.
    const recordedInput = actions.find(
      (candidate) =>
        dodge(candidate, context) &&
        Math.abs(landing.start - candidate.start - VINDICATOR_AIRBORNE_MS) <= EFFECT_PACKET_TOLERANCE_MS
    );
    // Some logs retain only Death Drop; its landing still proves the preceding 600 ms dodge.
    const input = recordedInput ?? { ...landing, start: landing.start - VINDICATOR_AIRBORNE_MS };
    jumps.set(landing, input);
    for (const candidate of actions) {
      if (
        isRecordedAutoattack(context, candidate) &&
        candidate.start >= input.start &&
        candidate.start < landing.start &&
        Math.abs(candidate.end - landing.start) <= EFFECT_PACKET_TOLERANCE_MS
      )
        airborneAutos.add(candidate);
    }
  }

  return actions.flatMap((action) => {
    if (
      action.status === 'interrupted' &&
      normalized(skillForAction(context, action)?.slot) === 'weapon_1' &&
      !committedStrikes.has(action)
    ) {
      return [];
    }

    // Even an unfinished last auto occupied the airborne lane; only damaging attempts count as confirmed bug uses.
    if (airborneAutos.has(action))
      return [{ ...action, vindicatorDodgeAuto: committedStrikes.has(action), concurrentTimeline: true }];
    if (!hasDeathDrop) return [action];
    if (dodge(action, context)) return [];
    const input = jumps.get(action);
    if (input) {
      // The simulation pays endurance on this input, before any mid-jump sigil refund, and owns the whole leap.
      return [
        {
          ...input,
          end: action.end,
          expectedDuration: Number(VINDICATOR_JUMP_SKILL.castTimeMs),
          canonicalSkillId: Number(VINDICATOR_JUMP_SKILL.id),
          canonicalName: VINDICATOR_JUMP_SKILL.name,
          forceCompleteReplay: true,
          replayCastEnd: input.start + Number(VINDICATOR_JUMP_SKILL.castTimeMs)
        }
      ];
    }

    return [action];
  });
}
