import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';
import { reactToJusticeHitWithOptions } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { quickfireRetainsTomePassive } from '#gw2/professions/guardian/specializations/firebrand/traits/behavior.js';

/** The tome passive tracks the shared Justice hit counter; Quickfire keeps it through dormancy. */
export function reactToTomeJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: quickfireRetainsTomePassive(context),
    skillId: GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
    skillName: 'Tome of Justice',
    // Tome passive Burning starts at one second; Amplified Wrath applies separately.
    passiveBurnDuration: 1
  });
}

/** Ashes of the Just consumes its live charges on accepted player strikes. */

/**
 * Consumes an available Ashes of the Just charge on an eligible player strike
 * and applies its burning packet subject to the trigger interval.
 */
export function reactToAshesHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext }: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  const ashesProfile = requireBalanceProfileFromContext(context, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  if (!burn) return;
  if (!hitContext || !isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;

  const state = firebrandState.from(context);
  if (!consumeCharge(state.ashes, event.at, balanceProfileNumber(ashesProfile, 'internalCooldown'), true)) return;

  emitAshes(context, event, state.ashesBurnDuration);
}

/** One charge uses the same burn payload as an accepted combat hit. */
export function emitAshes(context: GuardianResolverContext, event: GuardianResolverEvent, duration?: number): void {
  const ashesProfile = requireBalanceProfileFromContext(context, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  if (!burn) return;
  // Ashes burns resolve at charge consumption so same-timestamp condition
  // reactions cannot be reordered behind later damage packets.
  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      source: 'guardian',
      sourceId: 'guardian.ashes-of-the-just',
      actorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
      skillName: 'Epilogue: Ashes of the Just',
      // The charge owns its burning; the triggering attack retains the causal activation only.
      procType: 'profession',
      icon: context.helpers.skillsById.get(GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST)?.icon,
      name: 'Ashes of the Just — Burning',
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      condition: String(burn.condition),
      stacks: effectNumber(ashesProfile, burn, 'stacks'),
      duration: duration ?? effectNumber(ashesProfile, burn, 'duration')
    })
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'profession', name: 'Ashes of the Just', at: event.at, sourceSkill: event.skillName }
  });
}
