import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild
} from '#gw2/professions/mesmer/build/build.js';
import { MESMER_NATIVE_CATALOG_OPTIONS } from '#gw2/professions/mesmer/catalog/module-data.js';
import { mesmerNativeModules } from '#gw2/professions/mesmer/modules.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const mesmerProfession = defineNativeProfession({
  id: 'mesmer',
  name: 'Mesmer',
  catalog: MESMER_NATIVE_CATALOG_OPTIONS,
  build: {
    createBuildDefaults: createMesmerBuildDefaults,
    migrateBuild: migrateMesmerBuild,
    validateBuild: validateMesmerBuild
  },
  modules: mesmerNativeModules,
  autoattackChains: {
    // Mesmer roots have deliberately different persistence contracts; each
    // override is evaluated against the pending root instead of the profession globally.
    overrides: [
      {
        id: 'mesmer.ether-bolt-preserves-weapon-skills',
        chainRootIds: [ID.ETHER_BOLT],
        when: ({ interruptingSkill }) => interruptingSkill.type === 'Weapon',
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
          Number(interruptingSkill.quicknessCastTimeMs ?? interruptingSkill.castTimeMs ?? 0) > 400 &&
          interruptingSkill.rechargeAnchor !== 'castStart',
        decision: 'reset'
      }
    ]
  }
});

export default mesmerProfession;
