import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild
} from '#gw2/professions/mesmer/build/build.js';
import { mesmerNativeModules } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerWeaponSkillMatchesSet } from '#gw2/professions/mesmer/build/weapon-matching.js';

export { mesmerCatalog, mesmerNativeModules } from '#gw2/professions/mesmer/catalog.js';

export const mesmerProfession = defineNativeProfession({
  id: 'mesmer',
  name: 'Mesmer',
  requireEquippedSlotSkills: true,
  build: {
    createBuildDefaults: createMesmerBuildDefaults,
    migrateBuild: migrateMesmerBuild,
    validateBuild: validateMesmerBuild
  },
  modules: mesmerNativeModules,
  weaponSkillMatchesSet: mesmerWeaponSkillMatchesSet,
  autoattackChains: {
    // Mesmer roots have deliberately different persistence contracts; each
    // override is evaluated against the pending root instead of the profession globally.
    overrides: [
      {
        id: 'mesmer.ether-bolt-preserves-intervening-skills',
        chainRootIds: [ID.ETHER_BOLT],
        // Intervening skills never reset scepter progress, regardless of their type, damage, or cast length.
        decision: 'preserve'
      },
      {
        id: 'mesmer.imaginary-axes-preserves-axe',
        chainRootIds: [ID.LACERATING_CHOP],
        interruptingSkillIds: [ID.IMAGINARY_AXES],
        decision: 'preserve'
      },
      {
        id: 'mesmer.long-nonweapon-casts-reset',
        when: ({ interruptingSkill }) =>
          interruptingSkill.type !== 'Weapon' &&
          (interruptingSkill.castTimeMs ?? 0) > 400 &&
          interruptingSkill.rechargeAnchor !== 'castStart',
        decision: 'reset'
      }
    ]
  }
});
