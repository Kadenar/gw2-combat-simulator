import type { GuardianLuminaryState } from '#gw2/professions/guardian/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export function createLuminaryState(): GuardianLuminaryState {
  return {
    radiantForge: false,
    radiantForgeEndsAt: 0,
    radiantForgeEnteredAt: 0,
    radiantWeapon: '',
    // Tracks distinct weapon types so zero or one used weapon receives the reduced forge recharge.
    radiantWeaponsUsed: {},
    // Sword Glaring Burst alternates fast then slow until the sword is equipped again.
    glaringBurstSwordSlow: false,
    empoweredArmamentsUntil: 0,
    piercingStanceUntil: 0,
    lightAuraUntil: 0,
    // One-shot flags: set by a virtue cast, consumed by the next matching
    // radiant weapon so each proc fires at most once per virtue use.
    radiantJusticeArmed: false,
    radiantResolveArmed: false,
    radiantCourageSwordArmed: false,
    radiantCourageShieldArmed: false,
    // Resolver handlers activate the stance, count resolved strikes, and consume
    // the stacks at detonation; the scheduler only emits its boundary events.
    effulgentActiveUntil: 0,
    effulgentStacks: 0
  };
}

/** Keeps Luminary projection ownership beside the state that produces it. */
export const LUMINARY_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianLuminaryState)[] = Object.freeze([
  'radiantForge',
  'radiantForgeEndsAt',
  'radiantWeapon',
  'radiantWeaponsUsed',
  'empoweredArmamentsUntil',
  'piercingStanceUntil',
  'lightAuraUntil',
  'radiantJusticeArmed',
  'radiantResolveArmed',
  'radiantCourageSwordArmed',
  'radiantCourageShieldArmed',
  'effulgentActiveUntil',
  'effulgentStacks'
]);

export const LUMINARY_RESOLVER_END_STATE_KEYS: readonly (keyof GuardianLuminaryState)[] = Object.freeze([
  'lightAuraUntil',
  'effulgentActiveUntil',
  'effulgentStacks'
]);

export const LUMINARY_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<GuardianLuminaryState>> = Object.freeze({
  radiantForge: false,
  radiantForgeEndsAt: 0,
  radiantWeapon: '',
  radiantWeaponsUsed: {},
  empoweredArmamentsUntil: 0,
  piercingStanceUntil: 0,
  lightAuraUntil: 0,
  radiantJusticeArmed: false,
  radiantResolveArmed: false,
  radiantCourageSwordArmed: false,
  radiantCourageShieldArmed: false,
  effulgentActiveUntil: 0,
  effulgentStacks: 0
});

export const luminaryState = defineProfessionSpecializationState('Luminary', createLuminaryState);
