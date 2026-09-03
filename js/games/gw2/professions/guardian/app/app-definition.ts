import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
// Browser-facing Guardian composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp, preferOffhand } from '#gw2/app/create-adapter.js';
import { applyGuardianBuildAttributeRules } from '#gw2/professions/guardian/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/guardian/build/build.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import type { GuardianApplicationBuild } from '#gw2/professions/guardian/types.js';

// Exposes Guardian only through the shared browser application contract.
export const guardianAppAdapter = defineProfessionApp({
  profession: withActivePatchPreview(guardianProfession),
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
