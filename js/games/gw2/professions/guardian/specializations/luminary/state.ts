import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface GuardianLuminaryState {
  radiantForge: boolean;
  radiantForgeEndsAt: number;
  forgeActivationId: string | null;
  radiantWeapon: string;
  radiantWeaponsUsed: Record<string, boolean>;
  glaringBurstSwordSlow: boolean;
  empoweredArmamentsUntil: number;
  piercingStanceUntil: number;
  lightAuraUntil: number;
  radiantJusticeArmed: boolean;
  radiantResolveArmed: boolean;
  radiantCourageSwordArmed: boolean;
  effulgentActiveUntil: number;
  effulgentStacks: number;
  effulgentActivationId: string | null;
}

function createLuminaryState(): GuardianLuminaryState {
  return {
    radiantForge: false,
    radiantForgeEndsAt: 0,
    // Exact expiry work belongs to one entry, even if the form is replaced before it runs.
    forgeActivationId: null,
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
    // Accepted strikes accumulate only inside the current stance's detonation window.
    effulgentActiveUntil: 0,
    effulgentStacks: 0,
    // A replaced stance cannot be consumed by the previous activation's queued detonation.
    effulgentActivationId: null
  };
}

export const luminaryState = defineProfessionSpecializationState('Luminary', createLuminaryState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectLuminaryPlanningState(input: Gw2PlanningStateInput) {
  const state = luminaryState.from(input);
  return structuredClone({
    [STATE.RADIANT_FORGE]: state.radiantForge,
    [STATE.RADIANT_FORGE_ENDS_AT]: state.radiantForgeEndsAt,
    [STATE.RADIANT_WEAPON]: state.radiantWeapon,
    [STATE.RADIANT_WEAPONS_USED]: state.radiantWeaponsUsed,
    [STATE.EMPOWERED_ARMAMENTS_UNTIL]: state.empoweredArmamentsUntil,
    [STATE.PIERCING_STANCE_UNTIL]: state.piercingStanceUntil,
    [STATE.LIGHT_AURA_UNTIL]: state.lightAuraUntil,
    [STATE.RADIANT_JUSTICE_ARMED]: state.radiantJusticeArmed,
    [STATE.RADIANT_RESOLVE_ARMED]: state.radiantResolveArmed,
    [STATE.RADIANT_COURAGE_SWORD_ARMED]: state.radiantCourageSwordArmed,
    [STATE.EFFULGENT_ACTIVE_UNTIL]: state.effulgentActiveUntil,
    [STATE.EFFULGENT_STACKS]: state.effulgentStacks
  });
}
