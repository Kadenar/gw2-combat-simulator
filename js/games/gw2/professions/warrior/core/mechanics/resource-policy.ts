import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
type Queries = MechanicQueriesOf<Runtime>;
/** The selected owner distinguishes authored grants from ordinary hit gains and owns burst acceptance/spending. */
export interface WarriorResourcePolicy {
  grant(runtime: Runtime, amount: number): void;
  hitGain(runtime: Runtime, amount: number): void;
  burstSpend(runtime: Queries, skill: WarriorSkill): number;
  spendBurst(runtime: Runtime, amount: number): void;
  availability: NonNullable<RuntimeHooks<WarriorRuntimeState, WarriorSkill>['availability']>;
  reset(runtime: Runtime): void;
}
const policies = new WeakMap<WarriorRuntimeState['core'], WarriorResourcePolicy>();
/** Core installs its policy first; selected elite initialization explicitly replaces that contribution. */
export function selectWarriorResourcePolicy(runtime: Runtime, policy: WarriorResourcePolicy): void {
  policies.set(runtime.profession.core, policy);
}

/** Runtime identity keeps policy selection isolated between simultaneous simulations. */
export function warriorResourcePolicy(runtime: Queries): WarriorResourcePolicy {
  const policy = policies.get(runtime.profession.core);
  if (!policy) throw new Error('Warrior resource policy was not initialized.');
  return policy;
}

/** Authored skill and trait rewards go to the selected owner, including adrenaline-to-Flow conversion. */
export function grantWarriorResource(runtime: Runtime, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Resource grants must be finite and non-negative.');
  warriorResourcePolicy(runtime).grant(runtime, amount);
}
