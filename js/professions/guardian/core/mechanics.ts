import { GUARDIAN_SKILL_IDS as ID } from "../data/ids.js";

export const GUARDIAN_CORE_MECHANICS = Object.freeze({
  spear: Object.freeze({
    illuminatedMultiplierBySkillId: Object.freeze({
      [ID.HELIO_RUSH]: 1.5,
      [ID.GLEAMING_DISC]: 1.25,
      [ID.SOLAR_STORM]: 1.25,
    }),
    illuminationArmers: Object.freeze([
      ID.HELIO_RUSH,
      ID.GLEAMING_DISC,
      ID.SOLAR_STORM,
    ]),
    symbolLuminanceDurationMs: 5000,
  }),
  justiceBurn: Object.freeze({
    condition: "Burning",
    stacks: 1,
    duration: 2,
  }),
});
