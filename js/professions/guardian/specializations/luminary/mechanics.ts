import { LUMINARY_BALANCE_PROFILES, LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

const coefficient = (profileId: string): number =>
  Number(
    LUMINARY_BALANCE_PROFILES.find((profile) => profile.id === profileId)?.effects?.find(
      (effect) => effect.type === 'strike'
    )?.coefficient
  );

export const LUMINARY_MECHANICS = Object.freeze({
  radiantForge: Object.freeze({
    // Legacy read model; authoring lives in the corresponding balance profiles.
    glaringBurstCoefficientByWeapon: Object.freeze({
      hammer: coefficient(PROFILE.glaringBurstHammer),
      blade: coefficient(PROFILE.glaringBurstBlade)
    })
  })
});
