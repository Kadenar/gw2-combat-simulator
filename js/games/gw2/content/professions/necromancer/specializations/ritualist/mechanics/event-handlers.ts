import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { ritualistState } from '#gw2/content/professions/necromancer/specializations/ritualist/state.js';
import { EPSILON } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerWeaponSpellRecipient
} from '#gw2/content/professions/necromancer/types.js';

import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/specializations/ritualist/profiles.js';

/** Applies duration-stacking Painful Bond and advances its fixed-cadence damage pulses. */
export function handleNecromancerPainfulBond(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const definition = balanceProfileFromContext(context, PROFILE.painfulBond);
  const buff = balanceProfileEffect(definition, 'buff');
  const strike = balanceProfileEffect(definition, 'strike');
  const state = ritualistState.from(context);
  if (event.mode === 'apply') {
    const duration = Number(event.duration || buff?.duration || 10);
    // Painful Bond duration-stacks: overlapping applications add their full
    // duration to the remaining effect instead of refreshing its expiry.
    state.painfulBondUntil = Math.max(event.at, Number(state.painfulBondUntil || 0)) + duration;
    if (!Number.isFinite(state.painfulBondPulseAnchorAt)) {
      // Only the first application schedules the tick chain; stacked applications preserve its one-second cadence.
      const firstPulseAt = event.at + Number(definition?.initialDelay || 0.004);
      state.painfulBondPulseAnchorAt = firstPulseAt;
      enqueueOrdered(context.queue, {
        ...event,
        at: firstPulseAt,
        mode: 'tick'
      });
    }

    return;
  }

  if (event.mode !== 'tick') return;

  // Damage fires only while the debuff is still active; the final tick at expiry is suppressed
  if (event.at < Number(state.painfulBondUntil || 0) - EPSILON) {
    enqueueOrdered(context.queue, {
      type: 'damage',
      at: event.at,
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

  const nextAt = event.at + Number(definition?.pulseInterval || 1);
  if (nextAt <= context.horizon + EPSILON) {
    enqueueOrdered(context.queue, {
      ...event,
      at: nextAt,
      mode: 'tick'
    });
  }
}

/** Stores one weapon-spell application with independent charge state for each eligible recipient. */
export function handleNecromancerWeaponSpell(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (!event.spell) return;
  // Player and summons/allies each get separate stack counters; allies get fewer stacks unless Wielder's Boon is active
  const recipients: Record<string, NecromancerWeaponSpellRecipient> = {
    player: {
      stacks: Number(event.playerStacks || 0),
      nextAt: 0
    }
  };
  for (const recipient of event.resolvedAudience?.companionIds || []) {
    recipients[recipient] = {
      stacks: Number(event.allyStacks || 0),
      nextAt: 0
    };
  }

  ritualistState.from(context).weaponSpells[event.spell] = {
    skillId: event.skillId ?? undefined,
    skillName: event.skillName,
    appliedAt: event.at,
    expiresAt: event.at + Number(event.duration || 0),
    recipients,
    alliesReceiveFullBenefit: Boolean(event.alliesReceiveFullBenefit)
  };
}
