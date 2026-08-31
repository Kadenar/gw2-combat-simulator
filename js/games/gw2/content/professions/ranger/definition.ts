import { defineNativeProfession } from '#gw2/integrations/patches/authoring/profession.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import {
  createRangerBuildDefaults,
  migrateRangerBuild,
  validateRangerBuild
} from '#gw2/content/professions/ranger/build/build.js';
import { rangerNativeModules } from '#gw2/content/professions/ranger/modules.js';

export const rangerProfession = defineNativeProfession({
  id: 'ranger',
  name: 'Ranger',
  build: {
    createBuildDefaults: createRangerBuildDefaults,
    migrateBuild: migrateRangerBuild,
    validateBuild: validateRangerBuild
  },
  modules: rangerNativeModules,
  patchPreview: activePatchPreview
});

export default rangerProfession;
