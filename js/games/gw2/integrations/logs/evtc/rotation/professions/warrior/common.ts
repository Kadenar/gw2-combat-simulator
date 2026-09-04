import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import {
  createStrikePacketMatcher,
  firstStrikePacketOffsetMs
} from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { recordedActionSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  playerInitialBuff,
  sequentialInitialActions,
  type WarriorActionIdentity
} from '#gw2/integrations/logs/evtc/rotation/professions/warrior/shared.js';

// Stable identities for core skills that specialization openers may recover
// from the buffs present in ArcDPS's initial-state snapshot.
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
const REND_ANIMATION_ID = 80247;
const REND_FOLLOW_UP_ANIMATION_ID = 80224;

// Initial snapshots contain resulting buffs, not the casts that produced
// them. Some skills intentionally share a marker, so callers decide which
// skill is valid for the specialization's known opening sequence.
const CORE_PRECAST_BUFFS: Readonly<Record<WarriorCorePrecastId, number>> = {
  healingSignet: RESISTANCE_BUFF,
  mending: PEAK_PERFORMANCE_BUFF,
  signetOfRage: SWIFTNESS_BUFF,
  signetOfMight: SIGNET_OF_MIGHT_ACTIVE_BUFF,
  signetOfFury: SIGNET_OF_FURY_ACTIVE_BUFF,
  kick: PEAK_PERFORMANCE_BUFF,
  bullsCharge: PEAK_PERFORMANCE_BUFF
};

// ArcDPS emits these as a second animation row even though the player issued
// only the preceding Rush or Rend input.
const COMPOSITE_FOLLOW_UP_ANIMATION_IDS = new Set([
  14493, // Rush impact animation
  REND_FOLLOW_UP_ANIMATION_ID
]);

/** Reports whether the initial buff snapshot proves that the requested core precast occurred before logging began. */
export function detectedWarriorCorePrecast(
  context: EvtcProfessionReconstructionContext,
  id: WarriorCorePrecastId
): boolean {
  return playerInitialBuff(context, CORE_PRECAST_BUFFS[id]);
}

/** Returns the action identity only when its corresponding initial-state marker is present. */
export function detectedWarriorCorePrecastIdentity(
  context: EvtcProfessionReconstructionContext,
  id: WarriorCorePrecastId
): WarriorActionIdentity | null {
  return detectedWarriorCorePrecast(context, id) ? WARRIOR_CORE_ACTIONS[id] : null;
}

/** Filters a requested opener to detected core precasts and packs those casts backward from the supplied anchor. */
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

// Dual-wield skills can override the ordinary Quickness duration, so packet
// commitment checks must use the same duration that replay will use.
function runtimeCastDurationMs(skill: Skill): number {
  return Math.max(0, Number(skill.dualWieldCastTimeMs || skill.quicknessCastTimeMs || skill.castTimeMs || 0));
}

/**
 * Converts Warrior-specific ArcDPS animation artifacts into replayable player
 * inputs. Composite follow-up rows are folded into their parent cast, and a
 * cast is completed when an interrupted animation reached its commitment point
 * or produced observed strike evidence.
 */
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
  // Fold an internal animation into the most recent non-instant action. The
  // extended end time preserves the total input lockout without adding a cast.
  const absorbAnimation = (action: EvtcRecordedRotationAction): void => {
    let previousIndex = normalized.length - 1;
    while (previousIndex >= 0 && normalized[previousIndex].end <= normalized[previousIndex].start) {
      previousIndex -= 1;
    }

    if (previousIndex < 0) return;
    const previous = normalized[previousIndex];
    const completesRend =
      previous.rawSkillId === REND_ANIMATION_ID && action.rawSkillId === REND_FOLLOW_UP_ANIMATION_ID;
    normalized[previousIndex] = {
      ...previous,
      end: Math.max(previous.end, action.end),
      // Rend's two animation rows end at its two hits, before the full cast
      // lane releases. Replay one completed skill so the remaining tail is
      // supplied by Rend's modeled duration instead of an explicit wait.
      ...(completesRend
        ? {
            status: 'completed' as const,
            replayInterruptMs: undefined,
            forceCompleteReplay: true
          }
        : {})
    };
  };

  for (const action of actions) {
    if (COMPOSITE_FOLLOW_UP_ANIMATION_IDS.has(action.rawSkillId)) {
      absorbAnimation(action);
      continue;
    }

    const skill = recordedActionSkill(action, context);
    const autoattack =
      String(skill?.type || '').toLowerCase() === 'weapon' && String(skill?.slot || '').toLowerCase() === 'weapon_1';
    const commitMs = skill ? firstStrikePacketOffsetMs(skill, runtimeCastDurationMs(skill)) : null;
    const duration = Math.max(0, action.end - action.start);
    const committedStrike = skill != null && commitMs != null && validatePackets(action).anyObserved;
    // Keep genuine cancelled autoattack inputs so replay spends their observed
    // cast time without advancing the chain; only non-interrupted packet artifacts are folded away.
    if (autoattack && action.status !== 'interrupted' && !committedStrike && commitMs != null && duration < commitMs) {
      absorbAnimation(action);
      continue;
    }

    // ArcDPS may label a cast interrupted even after its first packet proves
    // commitment. Replay the full catalog lockout so the completed skill is
    // not shortened to the animation-stop timestamp.
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

/**
 * Removes Warrior inputs after the encounter's primary target first exits
 * combat or dies. Target agents use the encounter ID as their profession code
 * in EVTC, which distinguishes them from ordinary adds and player agents.
 */
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
