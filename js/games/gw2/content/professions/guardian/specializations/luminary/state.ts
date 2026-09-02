import type { GuardianLuminaryState } from '#gw2/content/professions/guardian/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export function createLuminaryState(): GuardianLuminaryState {
  return {
    radiantForge: false,
    radiantForgeEndsAt: 0,
    radiantForgeEnteredAt: 0,
    radiantWeapon: '',
    // Tracks distinct weapon types so exactly one used weapon can receive the reduced forge recharge.
    radiantWeaponsUsed: {},
    empoweredArmamentsUntil: 0,
    piercingStanceUntil: 0,
    lightAuraUntil: 0,
    lightFields: [],
    // One-shot flags: set by a virtue cast, consumed by the next matching
    // radiant weapon so each proc fires at most once per virtue use.
    radiantJusticeArmed: false,
    radiantCourageSwordArmed: false,
    radiantCourageShieldArmed: false,
    // Effulgent Stance tracking lives in scheduler state so the strike-count
    // window is checked in real time; the detonation event then replays it
    // into resolver state for damage calculation.
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
  radiantCourageSwordArmed: false,
  radiantCourageShieldArmed: false,
  effulgentActiveUntil: 0,
  effulgentStacks: 0
});

export const luminaryState = defineProfessionSpecializationState('Luminary', createLuminaryState);
