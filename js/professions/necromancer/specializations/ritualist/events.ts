import { ritualistState } from './state.js';
import { EPSILON } from '../../../../platform/engine/clock.js';
import { enqueueOrdered } from '../../../../platform/engine/event-queue.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerWeaponSpellRecipient
} from '../../types.js';
import { balanceProfileEffect, necromancerBalanceProfile } from '../../core/profiles.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export function handleNecromancerPainfulBond(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const definition = necromancerBalanceProfile(context, PROFILE.painfulBond);
  const buff = balanceProfileEffect(definition, 'buff');
  const strike = balanceProfileEffect(definition, 'strike');
  const state = ritualistState.from(context);
  if (event.mode === 'apply') {
    state.painfulBondUntil = Math.max(
      Number(state.painfulBondUntil || 0),
      event.at + Number(event.duration || buff?.duration || 10)
    );
    if (!Number.isFinite(state.painfulBondPulseAnchorAt)) {
      // Only the first apply within a continuous uptime schedules the tick chain; refreshes do not restart it
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
  for (const recipient of event.recipients || []) {
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
