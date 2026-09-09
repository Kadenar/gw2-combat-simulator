import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import type { EvtcRotationProfessionProfile } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
export type {
  EvtcRotationActionIdentity,
  EvtcRotationProfessionProfile
} from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
/** EVTC uses shared identities; cast evidence belongs to the versioned EI finders. */
export const EVTC_ROTATION_PROFILES = ROTATION_PROFILES;
export function evtcRotationProfile(
  professionId: string,
  specializationId: string
): EvtcRotationProfessionProfile | null {
  return (
    EVTC_ROTATION_PROFILES.find((p) => p.professionId === professionId && p.specializationId === specializationId) ??
    null
  );
}
