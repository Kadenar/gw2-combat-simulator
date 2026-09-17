import { ROTATION_PROFILES, type RotationProfessionProfile } from '#gw2/integrations/logs/shared/rotation/profiles.js';
export function evtcRotationProfile(professionId: string, specializationId: string): RotationProfessionProfile | null {
  return (
    ROTATION_PROFILES.find((p) => p.professionId === professionId && p.specializationId === specializationId) ?? null
  );
}
