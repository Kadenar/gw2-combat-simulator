// Browser-facing Guardian composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp, preferOffhand } from '../../../../app/create-adapter.js';
import { applyGuardianBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
import { guardianProfession } from '../definition.js';
import type { GuardianApplicationBuild } from '../types.js';

// Exposes Guardian only through the shared browser application contract.
export const guardianAppAdapter = defineProfessionApp({
  profession: guardianProfession,
  applyBuildAttributeRules: applyGuardianBuildAttributeRules,
  createDefaultTargetConditions,
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
