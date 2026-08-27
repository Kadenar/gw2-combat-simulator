import { ROTATION_PROFILES, type RotationProfessionProfile } from '../../lib/rotation/profiles.js';

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/** Resolves EI's profession/spec name to the shared combat-log rotation profile. */
export function dpsReportRotationProfile(profession: string): RotationProfessionProfile | null {
  const name = normalized(profession);
  return (
    ROTATION_PROFILES.find(
      (profile) =>
        normalized(profile.specializationName) === name ||
        (profile.specializationId === 'core' && normalized(profile.professionName) === name)
    ) || null
  );
}
