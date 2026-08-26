import { findRotationSkill } from '../../catalog.js';
import { committedActionsFromStrikePackets } from '../../effect-packets.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { canonicalCast, directSkillSignals } from './shared.js';

const MAX_AUTOATTACK_IMPACT_MS = 2000;
const WINDS_OF_CHAOS = Object.freeze({ name: 'Winds of Chaos', skillId: 10273 });
const WINDS_FIRST_IMPACT_MS = 533;

/**
 * Reconstructs Winds of Chaos casts whose animation records are missing by pairing their player-owned bounce packets
 * and adding one cast for each packet pair that cannot be matched to an existing action.
 */
function addMissingWindsOfChaosActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const packets = directSkillSignals(context, new Set([WINDS_OF_CHAOS.skillId]));
  const impacts = Array.from({ length: Math.ceil(packets.length / 2) }, (_, index) =>
    packets.slice(index * 2, index * 2 + 2)
  );
  const recorded = actions
    .filter(
      (action) =>
        Number(action.canonicalSkillId ?? action.rawSkillId) === WINDS_OF_CHAOS.skillId ||
        String(action.canonicalName || action.rawName).toLowerCase() === 'winds of chaos'
    )
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const unused = new Set(impacts.map((_, index) => index));
  for (const action of recorded) {
    const match = [...unused]
      .map((index) => ({
        index,
        distance: Math.abs(impacts[index][0].event.time - (action.start + WINDS_FIRST_IMPACT_MS))
      }))
      .filter(({ distance }) => distance <= MAX_AUTOATTACK_IMPACT_MS)
      .sort((left, right) => left.distance - right.distance || left.index - right.index)[0];
    if (match) unused.delete(match.index);
  }

  // Staff projectiles can omit their animation record while retaining both target
  // bounce packets. Reconstruct one cast per unmatched player-owned packet pair.
  const inferred = [...unused].map((index) => {
    const signal = impacts[index][0];
    const start = signal.event.time - WINDS_FIRST_IMPACT_MS;
    return canonicalCast(context, signal, WINDS_OF_CHAOS, start + 760, 'effect');
  });
  return [...actions, ...inferred];
}

/** Resolves an action against the active catalog and reports whether it occupies the weapon-autoattack slot. */
function isAutoattack(context: EvtcProfessionReconstructionContext, action: EvtcRecordedRotationAction): boolean {
  const skill = findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
  );
  return String(skill?.slot || '').toLowerCase() === 'weapon_1';
}

/**
 * Removes completed Mesmer autoattack animations that lack a confirming player strike, preserves interrupted chain
 * attempts, and restores missing Winds of Chaos casts from their damage packets.
 */
export function removeUncommittedMesmerAutoattacks(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const autoattacks = actions.filter((action) => isAutoattack(context, action));
  const committed = committedActionsFromStrikePackets(context, autoattacks, {
    maxFallbackImpactMs: MAX_AUTOATTACK_IMPACT_MS
  });
  const filtered = actions.filter((action) => {
    if (!isAutoattack(context, action)) return true;
    if (
      action.status === 'interrupted' &&
      String(action.canonicalName || action.rawName).toLowerCase() === 'winds of chaos'
    ) {
      return false;
    }

    // Preserve a recorded interrupted chain attempt: the simulator cancels its
    // effects and resets the chain instead of treating idle time as the input.
    if (action.status === 'interrupted') return true;

    // Clone packets reuse the player's autoattack IDs. Only player-source damage
    // proves that a recorded player animation committed and should advance the replay chain.
    return committed.has(action);
  });
  return addMissingWindsOfChaosActions(context, filtered);
}
