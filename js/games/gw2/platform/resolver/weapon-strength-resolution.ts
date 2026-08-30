import {
  sampleWeaponStrength,
  weaponStrengthMidpoint,
  weaponStrengthProfile,
  weaponStrengthProfileIdForEvent
} from '#gw2/platform/equipment/weapons/strength.js';
import { skillForEvent } from '#gw2/platform/resolver/event-skill.js';

import type { Gw2ResolvedWeaponStrength } from '#gw2/platform/equipment/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';

function streamActor(event: Gw2ResolverEvent): string {
  if (event.actorType === 'summon') {
    return 'summon';
  }

  if (event.actorType === 'effect') return 'effect';
  if (event.actorType === 'environment') return 'environment';
  return 'player';
}

function generatedActivationId(context: Gw2ResolverRuntime): string {
  context.weaponStrengthActivationOrder += 1;
  return `effect:resolver:${context.weaponStrengthActivationOrder}`;
}

/**
 * Resolves a fixed override, deterministic midpoint, or one cached stochastic
 * sample for the activation that owns the packet.
 */
export function resolvedWeaponStrength(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent
): Gw2ResolvedWeaponStrength {
  const explicit = Number(event.weaponStrength);
  if (event.weaponStrength != null && Number.isFinite(explicit)) {
    return {
      activationId: typeof event.activationId === 'string' ? event.activationId : null,
      profileId: 'fixed',
      value: explicit,
      sampled: false
    };
  }

  const skill = skillForEvent(context.helpers, event) ?? null;
  const profileId = weaponStrengthProfileIdForEvent(event, { skill });
  if (!profileId) {
    const fallback = Number(context.helpers.weaponStrength(event, context.config));
    return {
      activationId: typeof event.activationId === 'string' ? event.activationId : null,
      profileId: 'fixed-legacy',
      value: fallback,
      sampled: false
    };
  }

  const profile = weaponStrengthProfile(profileId);
  if (!context.random.stochastic) {
    return {
      activationId: typeof event.activationId === 'string' ? event.activationId : null,
      profileId: profile.id,
      value: weaponStrengthMidpoint(profile),
      sampled: false
    };
  }

  const activationId =
    typeof event.activationId === 'string' && event.activationId ? event.activationId : generatedActivationId(context);
  const existing = context.weaponStrengthRolls.get(activationId);
  if (existing) {
    if (existing.profileId !== profile.id) {
      throw new Error(
        `Activation ${activationId} changed weapon-strength profile ` + `from ${existing.profileId} to ${profile.id}.`
      );
    }

    return {
      activationId,
      ...existing,
      sampled: true
    };
  }

  const result = {
    profileId: profile.id,
    value: sampleWeaponStrength(profile, context.random.next(`weapon-strength:${streamActor(event)}`))
  };
  context.weaponStrengthRolls.set(activationId, result);
  return {
    activationId,
    ...result,
    sampled: true
  };
}
