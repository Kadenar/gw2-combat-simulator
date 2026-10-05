import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { EffectEmissionService } from '#gw2/platform/effects/emission.js';
import type { createProcRegistry } from '#gw2/platform/combat/procs.js';
import type { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import type { ExecutedFactsReader, ExecutedFactsWriter } from '#gw2/platform/combat/history/executed-facts.js';
import type { SimulationRandom } from '#kernel/core/simulation-random.js';
import type { CooldownController } from '#gw2/platform/execution/types.js';
import type { CastControl } from '#gw2/platform/execution/cast-contracts.js';
import type {
  createRuntimeResources,
  createRuntimeEndurance
} from '#gw2/platform/combat/resources/runtime-resources.js';
import type { createEffectReactions } from '#gw2/platform/resolver/effect-reactions.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { FlipWindowOptions } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { SkillFlipWindow } from '#gw2/platform/execution/skill-flips.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';

/** Preserve a family's concrete state and skill identities when a shared helper only reads mechanic facts. */
export type MechanicQueriesOf<TContext extends { profession: object; helpers: CanonicalCatalog }> =
  MechanicQueryContext<TContext['profession'], TContext['helpers']['skills'][number]>;

/** Selection and observation inspect current mechanic data and executed facts without scheduling or mutation capabilities. */
export interface MechanicQueryContext<T extends object = object, TSkill extends Skill = Skill> {
  readonly profession: ReadonlyMechanicState<T>;
  readonly config: Gw2Config;
  readonly helpers: CanonicalCatalog<TSkill>;
  readonly traits: ReadonlySet<SkillId>;
  readonly time: number;
  readonly activeWeaponSet: number;
  readonly combatStartPending?: boolean;
  readonly combatActive: boolean;
  readonly combat: Pick<
    ReturnType<typeof createMechanicCombatServices>,
    | 'activeBoonStacks'
    | 'boonApplications'
    | 'buffApplications'
    | 'activeBuffStacks'
    | 'boonSnapshot'
    | 'timeline'
    | 'targetHasCondition'
    | 'targetConditionStacks'
    | 'targetConditionCount'
    | 'targetHealthLoss'
    | 'targetHealthBelow'
    | 'remainingTargetHealthFraction'
    | 'statsAt'
    | 'conditionDurationMultiplier'
  >;
  readonly castController: Pick<
    CastControl,
    'hasInFlight' | 'inFlightSkillIds' | 'currentLaneEnd' | 'pendingCombatStart' | 'pendingChargeRelease'
  >;
  readonly resourceController: Pick<ReturnType<typeof createRuntimeResources<T>>, 'value' | 'readyAt'>;
  readonly endurance: Pick<ReturnType<typeof createRuntimeEndurance<T>>, 'readyAt'>;
  readonly facts: ExecutedFactsReader;
  readonly cooldownController: Pick<
    CooldownController,
    'readyAt' | 'hasCooldown' | 'hasAmmo' | 'readAmmo' | 'rechargeFor' | 'rate' | 'project' | 'remaining'
  >;
  combatStartedAt(at?: number): boolean;
}

/** Resolver mechanics own their profession slice and request shared changes through phase-preserving services. */
export interface MechanicCombatContext<T extends object = object, TSkill extends Skill = Skill> {
  profession: T;
  readonly config: Gw2Config;
  readonly traits: ReadonlySet<SkillId>;
  readonly helpers: CanonicalCatalog<TSkill>;
  readonly combat: ReturnType<typeof createMechanicCombatServices>;
  readonly effects: EffectEmissionService;
  readonly procs: ReturnType<typeof createProcRegistry>;
  readonly random: Readonly<SimulationRandom>;
  readonly activeWeaponSet: number;
  readonly combatStartTime?: number | null;
  readonly combatStartPending?: boolean;
  readonly deathTime: number | null;
}

/** Stateful lifecycle handlers can schedule named work and settle owned services, never traverse commands or edit engine stores. */
export interface MechanicContext<T extends object = object, TSkill extends Skill = Skill> extends MechanicCombatContext<
  T,
  TSkill
> {
  readonly queries: MechanicQueryContext<T, TSkill>;
  readonly time: number;
  readonly combatActive: boolean;
  readonly hasExplicitCombatStart: boolean;
  /** Cast acceptance and authored resets remain exclusive to the execution owner. */
  readonly cooldownController: Omit<CooldownController, 'resetAll' | 'spendAmmo' | 'setAmmoLockout'>;
  readonly castController: CastControl;
  readonly resourceController: ReturnType<typeof createRuntimeResources<T>>;
  readonly endurance: ReturnType<typeof createRuntimeEndurance<T>>;
  readonly facts: ExecutedFactsReader;
  readonly observations: ExecutedFactsWriter;
  readonly effectReactions: Pick<ReturnType<typeof createEffectReactions>, 'register'>;
  armFlip(skillId: SkillId, window?: FlipWindowOptions): SkillFlipWindow;
  consumeFlip(skillId: SkillId): SkillFlipWindow | undefined;
  combatStartedAt(at?: number): boolean;
  schedule(name: string, at: number, data?: unknown, owner?: WorkOwner, priority?: number): void;
  scheduleForCast(
    name: string,
    at: number,
    cast: RuntimeCast<TSkill>,
    data?: Record<string, unknown>,
    owner?: WorkOwner,
    priority?: number
  ): void;
  cancelOwner(owner: WorkOwner): void;
}
