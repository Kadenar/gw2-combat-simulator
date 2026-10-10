import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';

// Meticulous Custodian boosts the base strike coefficient of each artifact to its "enhanced" value; factors below are enhanced/base
export const METICULOUS_ARTIFACT_STRIKE_IDS = new Set<number>([
  ID.METAL_LEGION_GUITAR,
  ID.MISTBURN_MORTAR,
  ID.CHAK_SHIELD,
  ID.SUMMON_KRYPTIS_TURRET,
  ID.HOLO_DANCER_DECOY
]);

// Return the Meticulous Custodian strike multiplier only for the artifact and
// active identity window that owns the queried packet.
export function meticulousArtifactStrikeFactor(context: Gw2ModifierContext): number {
  const profile = requireBalanceProfileFromContext(context, TRAIT.METICULOUS_CUSTODIAN);
  const event = context.event;
  if (event?.skillId === ID.METAL_LEGION_GUITAR) {
    return event.metadata?.packetKind === 'thief.metal-legion-guitar-final-smash'
      ? balanceProfileNumber(profile, 'guitarFinalFactor')
      : balanceProfileNumber(profile, 'guitarFactor');
  }

  if (event?.skillId === ID.MISTBURN_MORTAR) return balanceProfileNumber(profile, 'mortarFactor');
  if (event?.skillId === ID.CHAK_SHIELD) return balanceProfileNumber(profile, 'chakFactor');
  if (event?.skillId === ID.SUMMON_KRYPTIS_TURRET) {
    return balanceProfileNumber(profile, 'kryptisFactor');
  }

  if (event?.skillId === ID.HOLO_DANCER_DECOY) return balanceProfileNumber(profile, 'holoFactor');
  return 1;
}

/** Identity lifetimes use the live Meticulous profile at commitment. */
export function artifactWindow(runtime: ThiefRuntime): {
  windows: ReturnType<typeof requireBalanceProfileFromContext>;
  duration: number;
} {
  const windows = requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows);
  const duration = balanceProfileNumber(
    hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN)
      ? requireBalanceProfileFromContext(runtime, TRAIT.METICULOUS_CUSTODIAN)
      : windows,
    'durationMultiplier'
  );
  return { windows, duration };
}

/** Resolve the selected Surfer packet profile at every occurrence, as before migration. */
export function forgedSurferProfile(runtime: ThiefRuntime) {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? PROFILE.forgedSurferMeticulous : PROFILE.forgedSurfer
  );
}

/** Kryptis has its separate enhanced identity lifetime. */
export function meticulousKryptisDuration(runtime: ThiefRuntime): number {
  const windows = requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows);
  return hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.METICULOUS_CUSTODIAN), 'kryptisDuration')
    : balanceProfileNumber(windows, 'minimumStacks');
}
