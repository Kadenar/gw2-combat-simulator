import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { engineerPhotonForgeSkillHandlers } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';

/** Applies Photon Forge lifecycle changes after the native skill effects run. */
export const holosmithSkillHandlers = Object.freeze({
  'engineer.photon-forge-enter': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.photon-forge-enter']
  }),
  'engineer.photon-forge-exit': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.photon-forge-exit']
  }),
  'engineer.heat': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.heat']
  }),
  'engineer.corona-burst-heat': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.corona-burst-heat']
  }),
  'engineer.photon-blitz-heat': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.photon-blitz-heat']
  })
});
