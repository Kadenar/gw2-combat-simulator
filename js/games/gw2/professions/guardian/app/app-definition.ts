// Browser-facing Guardian composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { preferOffhand } from '#gw2/app/create-adapter.js';
import { definePatchedProfessionApp } from '#gw2/app/create-patched-adapter.js';
import { applyGuardianBuildAttributeRules } from '#gw2/professions/guardian/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/guardian/build/build.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import type { GuardianApplicationBuild } from '#gw2/professions/guardian/types.js';

// Exposes Guardian only through the shared browser application contract.
export const guardianAppAdapter = definePatchedProfessionApp({
  profession: guardianProfession,
  applyBuildAttributeRules: applyGuardianBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Zeal',
  runtime: {
    buildConfigExtras: (app) => {
      const build = app.build as GuardianApplicationBuild;
      return { initialTomePages: build.initialTomePages };
    }
  },
  defaultOffhand: preferOffhand('Focus')
});
