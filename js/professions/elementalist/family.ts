import { defineNativeProfession } from '../../platform/gw2/native-profession.js';
import { activePatchPreview } from '../../patches/active-preview.js';
import { createElementalistBuildDefaults, migrateElementalistBuild, validateElementalistBuild } from './build.js';
import { ELEMENTALIST_NATIVE_CATALOG_OPTIONS, elementalistNativeModules } from './modules.js';
import { elementalistFamilyUi } from './ui.js';

export const elementalistProfession = defineNativeProfession({
  id: 'elementalist',
  name: 'Elementalist',
  build: {
    createBuildDefaults: createElementalistBuildDefaults,
    migrateBuild: migrateElementalistBuild,
    validateBuild: validateElementalistBuild
  },
  modules: elementalistNativeModules,
  presentation: elementalistFamilyUi,
  patchPreview: activePatchPreview,
  catalog: ELEMENTALIST_NATIVE_CATALOG_OPTIONS
});

export default elementalistProfession;
