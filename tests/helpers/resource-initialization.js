import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

const clockFields = ({ value, maximum, rate, recoveryMaximum }) => ({ value, maximum, rate, recoveryMaximum });

/**
 * Builds one Core resource pool both ways from the same selected tuning: the standalone factory that attribute previews
 * call, and the live pool once the runtime resource controller has initialized it at time zero.
 */
export function constructedAndInitializedPool(family, config, key, patchCatalog = (catalog) => catalog) {
  const native = family.runtimeFor(config);
  const catalog = patchCatalog(native.catalog);
  const balanceContext = { catalog, modifierRulesById: new Map() };
  let initialized;
  observeGw2Runtime({
    profession: { ...native, catalog, createState: (selected) => native.createState(selected, balanceContext) },
    config,
    rotation: [],
    engineInitialize(runtime) {
      initialized = clockFields(runtime.profession.core[key]);
    }
  });
  return { constructed: clockFields(native.createState(config, balanceContext).core[key]), initialized };
}
