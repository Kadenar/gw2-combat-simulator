import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { guardianResolverState } from '#gw2/professions/guardian/core/traits/shared.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';

// Symbol hits and projectile hits have independent ignition cooldowns. Torch pulses
// and fire-whirl bolts also ignite, but ordinary conditions and ignition itself do not.
export function reactToSymbolOfIgnition(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const symbolOfIgnitionProfile = requireBalanceProfileFromContext(context, PROFILE.symbolOfIgnition);
  const burning = requireEffect(symbolOfIgnitionProfile, 'condition', 'Burning');
  if (!burning) return;
  const burningBolt =
    event.type === 'condition' &&
    event.condition === 'Burning' &&
    !!event.comboId &&
    event.fieldType === 'Fire' &&
    event.finisherType === 'Whirl';
  const torchPulse =
    event.type === 'condition' && event.condition === 'Burning' && event.skillId === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME;
  if (
    !isGw2PlayerActorEvent(event) ||
    !((event.type === 'damage' && Number(event.coefficient || 0) > 0) || burningBolt || torchPulse) ||
    event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION
  ) {
    return;
  }

  const state = guardianResolverState(context);
  if (
    Number(state.symbolIgnitionUntil || 0) <= Number(state.symbolIgnitionStartsAt || 0) ||
    event.at < Number(state.symbolIgnitionStartsAt || 0) ||
    event.at > Number(state.symbolIgnitionUntil || 0)
  ) {
    return;
  }

  const projectile = event.projectile === true || burningBolt;
  const cooldownKey = projectile ? 'symbolProjectileIgnitionReadyAt' : 'symbolIgnitionReadyAt';
  // Match gw2combat's end-of-tick cooldown removal: the deadline itself is still blocked.
  if (!isInternalCooldownReady(event.at, state[cooldownKey])) return;

  state[cooldownKey] = event.at + balanceProfileNumber(symbolOfIgnitionProfile, 'internalCooldown');
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      priority: 5,
      source: 'guardian',
      sourceId: GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION,
      actorType: 'player',
      // Ignition remains attributed to the actual impact that claimed its cooldown.
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      skillId: GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION,
      skillName: 'Symbol of Ignition',
      name: 'Symbol of Ignition — Ignition',
      condition: String(burning.condition),
      stacks: effectNumber(symbolOfIgnitionProfile, burning, 'stacks'),
      duration: effectNumber(symbolOfIgnitionProfile, burning, 'duration'),
      triggeredBy: event.skillName,
      projectile
    })
  );
}
