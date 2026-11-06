import { validateResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import { defineProfession } from '#gw2/platform/profession-definition/compile-contract.js';

/** Fixtures keep state and modifiers separate from executable policies, validating the final hook overrides. */
export function defineTestProfession({ hooks, ...definition }) {
  const profession = defineProfession(definition);
  // Evaluators come only from compiled declarations; runtime hooks such as modifyEffects are not on the contract.
  for (const key of Object.keys(hooks ?? {})) {
    if (key.startsWith('modify') && key in profession) throw new TypeError(`Unsupported hooks field: ${key}.`);
  }

  return {
    ...profession,
    runtimeFor() {
      const runtime = {
        ...profession,
        // Fixtures expose the same required catalog and listener registry as native runtime compilation.
        skillSelectionCatalog: profession.catalog,
        triggerListeners: new Map(),
        ...hooks
      };
      validateResourcePolicies(runtime.resources, runtime.endurance);
      return runtime;
    }
  };
}
