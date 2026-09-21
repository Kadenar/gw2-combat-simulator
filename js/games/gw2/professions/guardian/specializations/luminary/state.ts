import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

export interface GuardianLuminaryState {
  radiantForge: boolean;
  radiantForgeEndsAt: number;
  radiantForgeEnteredAt: number;
  radiantWeapon: string;
  radiantWeaponsUsed: Record<string, boolean>;
  glaringBurstSwordSlow: boolean;
  empoweredArmamentsUntil: number;
  piercingStanceUntil: number;
  lightAuraUntil: number;
  radiantJusticeArmed: boolean;
  radiantResolveArmed: boolean;
  radiantCourageSwordArmed: boolean;
  radiantCourageShieldArmed: boolean;
  effulgentActiveUntil: number;
  effulgentStacks: number;
}

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
export const LUMINARY_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
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
} satisfies Partial<GuardianLuminaryState>);

export const luminaryState = defineProfessionSpecializationState('Luminary', createLuminaryState);
