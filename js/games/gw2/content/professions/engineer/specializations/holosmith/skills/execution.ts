// augmentSkill wires photon-forge logic into the native skill's afterEffects hook,
// which runs after all effect emissions for that skill have been processed.
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import { engineerPhotonForgeSkillHandlers } from '#gw2/content/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';

export const holosmithSkillHandlers = Object.freeze({
  'engineer.photon-forge-enter': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.photon-forge-enter']
  }),
  'engineer.photon-forge-exit': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.photon-forge-exit']
  }),
  'engineer.heat': augmentSkill({
    afterEffects: engineerPhotonForgeSkillHandlers['engineer.heat']
  })
});
