import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { resolverTimedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

/** Applies duration-stacking Painful Bond and advances its fixed-cadence damage pulses. */
export function handleNecromancerPainfulBond(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const definition = balanceProfileFromContext(context, PROFILE.painfulBond);
  const buff = balanceProfileEffect(definition, 'buff');
  const state = ritualistState.from(context);
  if (event.mode === 'apply') {
    const duration = Number(event.duration ?? buff?.duration ?? 10);
    // Painful Bond duration-stacks: overlapping applications add their full
    // duration to the remaining effect instead of refreshing its expiry.
    state.painfulBondUntil = gw2EffectExpiresAt(Math.max(event.at, Number(state.painfulBondUntil || 0)), duration);
    if (!Number.isFinite(state.painfulBondPulseAnchorAt)) {
      // Only the first application schedules the tick chain; stacked applications preserve its one-second cadence.
      const firstPulseAt = event.at + Number(definition?.initialDelay ?? 0.004);
      state.painfulBondPulseAnchorAt = firstPulseAt;
      painfulBondPulses.start(context, { key: 'painful-bond', at: firstPulseAt, captured: event });
    }

    return;
  }
}

// Keep the anchor alive through inactive gaps; only the damage window has exclusive expiry.
export const painfulBondPulses = resolverTimedEffect<NecromancerResolverContext, NecromancerResolverEvent>({
  id: 'necromancer.painful-bond-pulse',
  interval: (context) => Number(balanceProfileFromContext(context, PROFILE.painfulBond)?.pulseInterval ?? 1),
  effectsAt(context, at, event) {
    const definition = balanceProfileFromContext(context, PROFILE.painfulBond);
    const strike = balanceProfileEffect(definition, 'strike');
    const state = ritualistState.from(context);
    // Damage fires only while the debuff is still active; the final tick at expiry is suppressed
    if (at < Number(state.painfulBondUntil || 0)) {
      context.queue.enqueue({
        type: 'damage',
        at: at,
        name: 'Painful Bond',
        skillName: 'Painful Bond',
        coefficient: 0,
        flatStrikeBase: Number(strike?.flatStrikeBase || 0),
        flatStrikePowerCoeff: Number(strike?.flatStrikePowerCoeff || 0),
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        source: 'Spirit',
        sourceId: 'ritualist.painful-bond',
        actorType: 'effect',
        icon: String(definition?.icon || ''),
        skillWeapon: 'Unequipped',
        noCrit: true, // Painful Bond pulses cannot crit in-game regardless of stats
        triggeredBy: event.triggeredBy || 'Anguish'
      });
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
