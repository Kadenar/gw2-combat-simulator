import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
type Queries = MechanicQueriesOf<Runtime>;

/** Family rules select burst decisions from the selected state, without registering numeric pool owners. */
interface WarriorBurstRules {
  required(runtime: Queries, skill: WarriorSkill): number;
  spend(runtime: Queries, skill: WarriorSkill): number;
  bypass(runtime: Queries, skill: WarriorSkill): boolean;
  readonly resetEligible: boolean;
}
const coreRules: WarriorBurstRules = {
  required: (_runtime, skill) => skill.adrenalineCost ?? 0,
  spend: (runtime) => runtime.resourceController.value('adrenaline'),
  bypass: () => false,
  resetEligible: true
};
const cappedRules: WarriorBurstRules = {
  ...coreRules,
  spend: (runtime, skill) => Math.min(runtime.resourceController.value('adrenaline'), skill.adrenalineCost ?? 0)
};
const berserkerRules: WarriorBurstRules = {
  ...coreRules,
  spend: (runtime, skill) => (skill.primalBurst ? cappedRules : coreRules).spend(runtime, skill),
  // Active Berserk must reach its mode-expiry retry even while the temporary cap is below the entry cost.
  bypass: (runtime, skill) =>
    skill.id === ID.BERSERK &&
    runtime.profession.specialization.kind === 'Berserker' &&
    runtime.profession.specialization.state.berserkActive
};
const bladeswornRules: WarriorBurstRules = {
  required: () => 0,
  spend: () => 0,
  bypass: () => true,
  resetEligible: false
};
const rules = {
  Core: coreRules,
  Berserker: berserkerRules,
  Spellbreaker: cappedRules,
  Paragon: cappedRules,
  Bladesworn: bladeswornRules
};

export function warriorBurstRules(runtime: Queries): WarriorBurstRules {
  return rules[runtime.profession.specialization.kind];
}

/** Authored combat rewards convert adrenaline to Flow for Bladesworn; ordinary hit gains never use this route. */
export function grantWarriorResource(runtime: Runtime, amount: number): void {
  runtime.resourceController.grant(
    runtime.profession.specialization.kind === 'Bladesworn' ? 'flow' : 'adrenaline',
    amount
  );
}
