import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

/** Run focused Guardian boundaries with real native owners and optional queued fixture events. */
export function runGuardian(
  rotation,
  overrides = {},
  initialize = () => {},
  source = guardianProfession,
  output = 'detailed'
) {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    selectedTraitIds: [],
    stats: { power: 2000, precision: 1000, conditionDamage: 1000 },
    target: { armor: 2597 },
    ...overrides
  };
  const native = source.runtimeFor(config);
  return observeGw2Runtime({
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation,
    output
  });
}
