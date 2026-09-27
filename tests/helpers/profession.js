import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { resourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';

/** Builds focused runtime fixtures from the same normalized modifiers and resources used by native professions. */
export function defineTestProfession({ hooks, ...definition }) {
  const profession = defineProfession(definition);
  return {
    ...profession,
    runtimeFor() {
      return {
        ...profession,
        resources: resourcePolicies(definition.resources ?? {}),
        endurance: definition.resources?.endurance,
        ...hooks
      };
    }
  };
}
