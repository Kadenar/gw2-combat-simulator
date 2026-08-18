import { GUARDIAN_SKILL_IDS as ID } from '../data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILES, GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

const profile = (id: string | number) => GUARDIAN_CORE_BALANCE_PROFILES.find((entry) => entry.id === id)!;
const effect = (id: string | number, index = 0) => (profile(id).effects || [])[index]!;

export const GUARDIAN_CORE_MECHANICS = Object.freeze({
  spear: Object.freeze({
    illuminatedMultiplierBySkillId: Object.freeze({
      [ID.HELIO_RUSH]: Number(profile(PROFILE.spearHelioRush).damageMultiplier),
      [ID.GLEAMING_DISC]: Number(profile(PROFILE.spearGleamingDisc).damageMultiplier),
      [ID.SOLAR_STORM]: Number(profile(PROFILE.spearSolarStorm).damageMultiplier)
    }),
    illuminationArmers: Object.freeze([ID.HELIO_RUSH, ID.GLEAMING_DISC, ID.SOLAR_STORM]),
    symbolLuminanceDurationMs: Number(effect(PROFILE.spearLuminance).duration) * 1000
  }),
  justiceBurn: Object.freeze({
    condition: String(effect(PROFILE.justice).condition),
    stacks: Number(effect(PROFILE.justice).stacks),
    activeDuration: Number(effect(PROFILE.justice).duration),
    passiveDuration: Number(effect(PROFILE.justice, 1).duration)
  })
});
