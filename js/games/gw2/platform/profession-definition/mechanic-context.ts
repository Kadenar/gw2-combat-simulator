import type { CombatEngagementQueries } from '#gw2/platform/combat/engagement.js';
import type { ExecutedFactsReader, ExecutedFactsWriter } from '#gw2/platform/combat/history/executed-facts.js';
import type { ProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import type {
  EnduranceController,
  EnduranceQueries,
  ResourceController,
  ResourceQueries
} from '#gw2/platform/combat/resources/resource-policy.js';
import type { AlliedStrikeGrants } from '#gw2/platform/combat/state/allied-strikes.js';
import type { EffectEmissionService } from '#gw2/platform/effects/emission.js';
import type {
  AutoattackChainQueries,
  MechanicAutoattackController
} from '#gw2/platform/execution/autoattack-chains.js';
import type { CastControl, CastQueries } from '#gw2/platform/execution/cast-contracts.js';
import type { CooldownQueries, MechanicCooldownController } from '#gw2/platform/execution/cooldown-contracts.js';
import type { SkillFlipCommands, SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { TriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { EffectReactionRegistration } from '#gw2/platform/resolver/effect-reactions.js';
import type { MechanicCombatQueries, MechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import type { Gw2Config, Gw2RuntimeConfig } from '#gw2/platform/simulation/config.js';
import type { TaskScheduling } from '#gw2/platform/simulation/work-contract.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';

/** Preserve a family's concrete state and skill identities when a shared helper only reads mechanic facts. */
export type MechanicQueriesOf<TContext extends { profession: object; helpers: CanonicalCatalog }> =
  MechanicQueryContext<TContext['profession'], TContext['helpers']['skills'][number]>;

/** Selection and observation inspect current mechanic data and executed facts without scheduling or mutation capabilities. */
export interface MechanicQueryContext<T extends object = object, TSkill extends Skill = Skill> {
  readonly profession: ReadonlyMechanicState<T>;
  readonly flips: Readonly<SkillFlipWindows>;
  readonly autoattackController: AutoattackChainQueries;
  readonly config: Gw2RuntimeConfig;
  readonly helpers: CanonicalCatalog<TSkill>;
  readonly traits: ReadonlySet<SkillId>;
  readonly time: number;
  readonly activeWeaponSet: number;
  readonly engagement: CombatEngagementQueries;
  readonly combat: MechanicCombatQueries;
  readonly castController: CastQueries;
  readonly resourceController: ResourceQueries;
  readonly endurance: EnduranceQueries;
  readonly facts: ExecutedFactsReader;
  readonly cooldownController: CooldownQueries;
}

/** Resolver mechanics own their profession slice and request shared changes through phase-preserving services. */
export interface MechanicCombatContext<T extends object = object, TSkill extends Skill = Skill> {
  profession: T;
  readonly config: Gw2Config;
  readonly traits: ReadonlySet<SkillId>;
  readonly helpers: CanonicalCatalog<TSkill>;
  readonly combat: MechanicCombatServices;
  readonly effects: EffectEmissionService;
  readonly alliedStrikes: AlliedStrikeGrants;
  readonly procs: ProcRegistry;
  readonly random: Readonly<SimulationRandom>;
  readonly activeWeaponSet: number;
  readonly engagement: CombatEngagementQueries;
  readonly deathTime: number | null;
}

/** Stateful lifecycle handlers can schedule named work and settle owned services, never traverse commands or edit engine stores. */
export interface MechanicContext<T extends object = object, TSkill extends Skill = Skill>
  extends MechanicCombatContext<T, TSkill>, SkillFlipCommands, TaskScheduling<TSkill> {
  readonly config: Gw2RuntimeConfig;
  readonly queries: MechanicQueryContext<T, TSkill>;
  readonly time: number;
  /** Cast acceptance and authored resets remain exclusive to the execution owner. */
  readonly cooldownController: MechanicCooldownController;
  readonly castController: CastControl;
  /** Mechanics inspect or reset progress; cast execution alone advances it. */
  readonly autoattackController: MechanicAutoattackController;
  readonly resourceController: ResourceController;
  readonly endurance: EnduranceController;
  readonly facts: ExecutedFactsReader;
  readonly observations: ExecutedFactsWriter;
  readonly effectReactions: EffectReactionRegistration;
  /** Run the selected traits listening to a mechanic-owned boundary, synchronously and in the point's order. */
  fireTrigger(point: TriggerPoint<Record<string, never>>): void;
  fireTrigger<TInput extends object>(point: TriggerPoint<TInput>, input: NoInfer<TInput>): void;
}
