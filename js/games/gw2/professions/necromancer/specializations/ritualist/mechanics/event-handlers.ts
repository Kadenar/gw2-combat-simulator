import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { resolverTimedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

/** Applies duration-stacking Painful Bond and advances its fixed-cadence damage pulses. */
export function handleNecromancerPainfulBond(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const definition = requireBalanceProfileFromContext(context, PROFILE.painfulBond);
  const state = ritualistState.from(context);
  if (event.mode === 'apply') {
    // The scheduler stamps the authored window on every application.
    const duration = Number(event.duration);
    // Painful Bond duration-stacks: overlapping applications add their full
    // duration to the remaining effect instead of refreshing its expiry.
    state.painfulBondUntil = gw2EffectExpiresAt(Math.max(event.at, Number(state.painfulBondUntil || 0)), duration);
    if (!Number.isFinite(state.painfulBondPulseAnchorAt)) {
      // Only the first application schedules the tick chain; stacked applications preserve its one-second cadence.
      const firstPulseAt = event.at + balanceProfileNumber(definition, 'initialDelay');
      state.painfulBondPulseAnchorAt = firstPulseAt;
      painfulBondPulses.start(context, { key: 'painful-bond', at: firstPulseAt, captured: event });
    }

    return;
  }
}

// Keep the anchor alive through inactive gaps; only the damage window has exclusive expiry.
export const painfulBondPulses = resolverTimedEffect<NecromancerResolverContext, NecromancerResolverEvent>({
  id: 'necromancer.painful-bond-pulse',
  interval: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.painfulBond), 'pulseInterval'),
  effectsAt(context, at, event) {
    const definition = requireBalanceProfileFromContext(context, PROFILE.painfulBond);
    const strike = requireEffect(definition, 'strike', 'Strike');
    const state = ritualistState.from(context);
    // Damage fires only while the debuff is still active; the final tick at expiry is suppressed. A removed strike
    // keeps the cadence but emits no pulse damage.
    if (strike && at < Number(state.painfulBondUntil || 0)) {
      context.queue.enqueue(
        buildResolverStrike({
          at: at,

          skillName: 'Painful Bond',
          coefficient: 0,
          flatStrikeBase: effectNumber(definition, strike, 'flatStrikeBase'),
          flatStrikePowerCoeff: effectNumber(definition, strike, 'flatStrikePowerCoeff'),

          source: 'Spirit',
          sourceId: 'ritualist.painful-bond',
          actorType: 'effect',
          icon: String(definition.icon || ''),
          skillWeapon: 'Unequipped',
          noCrit: true, // Painful Bond pulses cannot crit in-game regardless of stats
          triggeredBy: event.triggeredBy || 'Anguish'
        })
      );
    }
  }
});

/** Stores one weapon-spell application with independent charge state for each eligible recipient. */
export function handleNecromancerWeaponSpell(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (!event.spell) return;
  // Player and summons/allies each get separate stack counters; allies get fewer stacks unless Wielder's Boon is active
  const recipients: Record<string, ChargeGrant> = {
    player: grantCharges(Number(event.playerStacks || 0), event.at + Number(event.duration || 0))
  };
  for (const recipient of event.resolvedAudience?.companionIds || []) {
    recipients[recipient] = grantCharges(Number(event.allyStacks || 0), event.at + Number(event.duration || 0));
  }

  ritualistState.from(context).weaponSpells[event.spell] = {
    skillId: event.skillId ?? undefined,
    skillName: event.skillName,
    appliedAt: event.at,
    recipients,
    alliesReceiveFullBenefit: Boolean(event.alliesReceiveFullBenefit)
  };
}
