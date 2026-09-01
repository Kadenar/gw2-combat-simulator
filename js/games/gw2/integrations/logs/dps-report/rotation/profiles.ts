import { ROTATION_PROFILES, type RotationProfessionProfile } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';

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
