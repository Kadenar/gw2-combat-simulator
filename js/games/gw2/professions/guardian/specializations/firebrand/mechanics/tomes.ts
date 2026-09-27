/** Ashes of the Just consumes its live charges on accepted player strikes. */
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';

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

  // Ashes burns resolve at charge consumption so same-timestamp condition
  // reactions cannot be reordered behind later damage packets.
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'guardian',
      sourceId: 'guardian.ashes-of-the-just',
      actorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
      skillName: 'Epilogue: Ashes of the Just',
      name: 'Ashes of the Just — Burning',
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      condition: String(burn.condition),
      stacks: effectNumber(ashesProfile, burn, 'stacks'),
      duration: state.ashesBurnDuration
    })
  );
  context.recordProc('profession', 'Ashes of the Just', event.at, event.skillName);
}
