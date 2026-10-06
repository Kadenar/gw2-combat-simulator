import {
  sampleWeaponStrength,
  weaponStrengthMidpoint,
  weaponStrengthProfile,
  weaponStrengthProfileForName
} from '#gw2/platform/equipment/weapons/strength.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2NonWeaponEffectEvent } from '#gw2/platform/combat/state/event-ownership.js';

import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolvedWeaponStrength } from '#gw2/platform/equipment/weapons/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Weapon-strength resolution: choose each packet's profile, then resolve its midpoint or per-activation sample. */

interface WeaponStrengthProfileContext {
  readonly skill?: Skill | null;
  readonly activeWeaponSet?: number;
  readonly config?: Gw2Config;
}

/**
 * Selects a profile from canonical metadata and the active weapon set without receiving runtime state. This function is
 * intended to run while an activation is being scheduled, before a delayed
 * packet can observe a later weapon or transform state.
 */
export function weaponStrengthProfileIdForEvent(
  event: SimulationEventBase,
  { skill = null, activeWeaponSet = 1, config = {} }: WeaponStrengthProfileContext = {}
): string | null {
  if (event.weaponStrengthProfileId != null) {
    return weaponStrengthProfile(event.weaponStrengthProfileId).id;
  }

  // Explicit effect profiles own transformations; names below describe equipped weapons only.
  for (const candidate of [event.weapon, event.skillWeapon]) {
    const profile = weaponStrengthProfileForName(candidate);
    if (profile) return profile.id;
  }

  if (event.weaponStrengthSource === 'equipped') {
    const activeSet = activeWeaponSet === 2 ? 2 : 1;
    const configured = gw2ActivePrimaryWeapon(config, activeSet);
    const profile = weaponStrengthProfileForName(configured);
    if (profile) return profile.id;
  }

  if (isGw2NonWeaponEffectEvent(event)) {
    return 'nonweapon.unequipped';
  }

  for (const candidate of [skill?.weapon, skill?.skillWeapon]) {
    const profile = weaponStrengthProfileForName(candidate);
    if (profile) return profile.id;
  }

  // Slot skills and system actions are explicitly independent of equipped weapons.
  if (['Action', 'Heal', 'Utility', 'Elite'].includes(skill?.type || '')) {
    return 'nonweapon.unequipped';
  }

  if ((skill?.type || '') === 'Profession') {
    return 'nonweapon.profession-mechanic';
  }

  // This final configured-weapon branch only runs in the scheduler, where the
  // active set still represents activation time.
  const activeSet = activeWeaponSet === 2 ? 2 : 1;
  const configured = gw2ActivePrimaryWeapon(config, activeSet);
  return weaponStrengthProfileForName(configured)?.id || null;
}

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
    // Scaling strikes must resolve through a canonical profile or explicit override so malformed packets fail loudly.
    throw new TypeError(
      `Coefficient damage event ${String(event.skillId ?? event.sourceId)} ` +
        'requires a resolvable weapon-strength profile or explicit weaponStrength.'
    );
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
