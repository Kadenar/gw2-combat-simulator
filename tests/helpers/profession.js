import { defineProfession } from '#gw2/platform/profession-definition/compile-contract.js';
import { validateResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';

/** Fixtures keep state and modifiers separate from executable policies, validating the final hook overrides. */
export function defineTestProfession({ hooks, ...definition }) {
  const profession = defineProfession(definition);
  return {
    ...profession,
    runtimeFor() {
      const runtime = {
        ...profession,
        ...hooks
      };
      validateResourcePolicies(runtime.resources, runtime.endurance);
      return runtime;
    }
  };
}
