import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { improvisationShadowForceMultiplier } from '#gw2/professions/thief/core/traits/deadly-arts/steal.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';

/** Resolve Siphon's selected tuning without mutation: add Amplified Siphoning before multiplying by Improvisation. */
export function siphonShadowForceGain(runtime: MechanicQueriesOf<ThiefRuntime>): number {
  const base = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'lifeForceGain');
  const amplified = hasTrait(runtime, TRAIT.AMPLIFIED_SIPHONING)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.AMPLIFIED_SIPHONING), 'resourceGain')
    : 0;
  return (base + amplified) * improvisationShadowForceMultiplier(runtime);
}

export const ROT_WALLOW_VENOM_ICON =
  'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png';

// Second Opinion grants an extra +90 condition damage only while wielding Scepter in the active set.
export function wieldingScepter(context: Gw2ModifierContext): boolean {
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  return gw2PrimaryWeapon(context.config, activeSet) === 'Scepter';
}
