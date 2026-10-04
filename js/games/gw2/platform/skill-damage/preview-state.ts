import { createDamageExecution } from '#gw2/platform/skill-damage/occurrence-driver.js';
import type { DamageInputs } from '#gw2/platform/skill-damage/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { runRuntime } from '#gw2/platform/simulation/runtime.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';

/** Read shared damage state after the same initialization and assumption settlement used by measured occurrences. */
export function queryDamagePreview<T>(
  source: Gw2ProfessionSource,
  config: Gw2Config,
  inputs: DamageInputs,
  read: (runtime: Gw2Runtime) => T
): T {
  const isolatedConfig = structuredClone(config);
  const profession = source.runtimeFor(isolatedConfig, { traitTriggers: false });
  let value: T;
  runRuntime({
    profession,
    config: isolatedConfig,
    output: 'damage',
    ownsEffect: () => false,
    execution: createDamageExecution(profession, {
      inputs,
      accepts: (event) => String(event.sourceId).startsWith('assumption.'),
      emit(runtime) {
        value = read(runtime);
      }
    })
  });
  return value!;
}
