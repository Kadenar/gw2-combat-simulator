import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import type { EvtcRotationProfessionProfile } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
export type {
  EvtcRotationActionIdentity,
  EvtcRotationProfessionProfile
} from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
export function evtcRotationProfile(
  professionId: string,
  specializationId: string
): EvtcRotationProfessionProfile | null {
  return (
    ROTATION_PROFILES.find((p) => p.professionId === professionId && p.specializationId === specializationId) ?? null
  );
}
