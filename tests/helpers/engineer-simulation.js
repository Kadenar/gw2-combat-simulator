import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

/** Focused scenarios seed or probe the registered live owner without constructing scheduler-shaped fixtures. */
export function runEngineer(
  rotation,
  config = {},
  { initialize = () => {}, extend = () => ({}), observation, output } = {}
) {
  const options = {
    specialization: 'Core',
    selectedTraitIds: [],
    boons: {},
    target: { armor: 2597, conditions: {} },
    ...config
  };
  const native = engineerProfession.runtimeFor(options);
  return observeGw2Runtime({
    config: options,
    rotation,
    observation,
    output,
    profession: {
      ...native,
      ...extend(native),
      initialize(runtime) {
        native.initialize(runtime);
        initialize(runtime);
      }
    }
  });
}
