import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createGuardianBuildDefaults, migrateGuardianBuild, validateGuardianBuild } from './build/build.js';
import { guardianNativeModules } from './modules.js';
import { GUARDIAN_SKILL_IDS as ID } from './data/ids.js';

export const guardianProfession = defineNativeProfession({
  id: 'guardian',
  name: 'Guardian',
  build: {
    createBuildDefaults: createGuardianBuildDefaults,
    migrateBuild: migrateGuardianBuild,
    validateBuild: validateGuardianBuild
  },
  modules: guardianNativeModules,
  autoattackChains: {
    overrides: [
      {
        // Torch can coexist only with one-handed roots; two-handed chains must still reset.
        id: 'guardian.zealots-flame-preserves-one-handed-roots',
        chainRootIds: [ID.SWORD_OF_WRATH, ID.TRUE_STRIKE, ID.CORE_CLEAVE],
        interruptingSkillIds: [ID.ZEALOTS_FLAME],
        decision: 'preserve'
      }
    ]
  },
  patchPreview: activePatchPreview
});

export default guardianProfession;
