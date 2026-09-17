import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  CastContext,
  CastLifecycleContext,
  ScheduledTask,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState
} from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type {
  Gw2ApplicationBuild,
  Gw2Build,
  Gw2BuildSpecialization,
  Gw2CanonicalBuild,
  ProfessionBuildAssumptions
} from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { AntiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { DaredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import type { DeadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { SpecterState } from '#gw2/professions/thief/specializations/specter/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export type ThiefDodge = 'Dodge' | 'Lotus Training' | 'Bounding Dodger' | 'Unhindered Combatant';

export interface ThiefBuild extends Gw2Build {
  assumptions?: ProfessionBuildAssumptions;
  specializations?: Gw2BuildSpecialization[];
  selectedSkills?: Record<string, string>;
  selectedDodge?: ThiefDodge;
  initialInitiative?: number;
  initialShadowForce?: number;
}

export interface ThiefCanonicalBuild extends Gw2CanonicalBuild {
  assumptions: SchedulerRecord;
  selectedDodge: ThiefDodge;
  initialInitiative: number;
  initialShadowForce: number;
}

export interface ThiefApplicationBuild extends Gw2ApplicationBuild {
  selectedDodge: ThiefDodge;
  initialInitiative: number;
  initialShadowForce: number;
}

export interface ThiefDeterministicChoices extends SchedulerRecord {
  readonly forgedSurferBombsHit?: number;
}

export interface ThiefConfig extends Gw2Config {
  readonly specialization?: string;
  readonly assumptions?: ProfessionBuildAssumptions;
  readonly professionAssumptions?: ProfessionBuildAssumptions;
  readonly selectedDodge?: ThiefDodge;
  readonly initialInitiative?: number;
  readonly initialShadowForce?: number;
  readonly deterministicChoices?: ThiefDeterministicChoices;
}

// Shared by Core stealth attacks, Deadeye, and Antiquary.
export interface ThiefStealthAttackChargeState {
  stealthAttackCharges: number;
  stealthAttackExpiresAt: number;
}

export type ThiefArtifactKind = 'offensive' | 'defensive';
export type ThiefDoubleEdgeOutcome = 'success' | 'backfire';

export interface ThiefState extends ThiefCoreState, DaredevilState, DeadeyeState, SpecterState, AntiquaryState {}

export interface ThiefRuntimeState {
  core: ThiefCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Daredevil'; state: DaredevilState }
    | { kind: 'Deadeye'; state: DeadeyeState }
    | { kind: 'Specter'; state: SpecterState }
    | { kind: 'Antiquary'; state: AntiquaryState };
}

export interface ThiefSummonCondition extends SchedulerRecord {
  readonly condition: string;
  readonly duration: number;
  readonly stacks: number;
}

export interface ThiefSummonStrike extends SchedulerRecord {
  readonly name: string;
  readonly coefficientPerHit: number;
  readonly hits?: number;
  readonly initialDelay: number;
  readonly interval?: number;
  readonly skillId?: SkillId;
  readonly conditions?: readonly ThiefSummonCondition[];
}

export interface ThiefSummonDefinition extends SchedulerRecord {
  readonly name: string;
  readonly displayName?: string;
  readonly variant?: string;
  readonly weapon: string;
  readonly weaponStrengthProfileId: string;
  readonly attacks?: readonly ThiefSummonStrike[];
}

export interface ThiefSummonAttack extends SchedulerRecord {
  readonly basePower: number;
  readonly criticalChance: number;
  readonly criticalDamage: number;
  readonly duration: number;
  readonly fallbackAttacks?: readonly ThiefSummonStrike[];
  readonly summons: readonly ThiefSummonDefinition[];
}

export interface ThiefSkill extends Skill {
  readonly artifactKind?: ThiefArtifactKind;
  readonly backfire?: boolean;
  readonly doubleEdge?: boolean;
  readonly dualWieldFollowup?: boolean;
  readonly dualWieldOpener?: boolean;
  readonly initiativeCost?: number;
  readonly kneelSkill?: boolean;
  readonly malicious?: boolean;
  readonly movementSkill?: boolean;
  readonly shadowstepSkill?: boolean;
  readonly preservesStealth?: boolean;
  readonly shadowShroudSkill?: boolean;
  readonly spearStealthAttack?: boolean;
  readonly stealthAttack?: boolean;
  readonly stealTraitSkill?: boolean;
  readonly stealRechargeMode?: 'multiplicative' | 'additive';
  readonly summonAttack?: ThiefSummonAttack;
}

export type ThiefSchedulerContext = SchedulerContext<ThiefRuntimeState> & {
  /** Active specialization completion runs after Core steal resources and before its final snapshot. */
  onThiefStealComplete?: (context: ThiefCastContext) => void;
  readonly catalog: CanonicalCatalog<ThiefSkill>;
  readonly config: ThiefConfig;
};

export type ThiefPrecastContext = CastContext<ThiefRuntimeState> & {
  readonly catalog: CanonicalCatalog<ThiefSkill>;
  readonly config: ThiefConfig;
  readonly skill: ThiefSkill;
};

export type ThiefCastContext = CastLifecycleContext<ThiefRuntimeState> &
  Pick<ThiefSchedulerContext, 'onThiefStealComplete'> & {
    readonly catalog: CanonicalCatalog<ThiefSkill>;
    readonly config: ThiefConfig;
    readonly skill: ThiefSkill;
  };

export type ThiefResourceContext = ThiefSchedulerContext & {
  readonly start?: number;
};

export type ThiefEmissionContext = ThiefSchedulerContext & {
  readonly skill?: ThiefSkill;
};

export type ThiefScheduledTask<TPayload = SchedulerRecord> = Omit<ScheduledTask<TPayload>, 'payload'> & {
  readonly payload: TPayload;
};

export type ThiefSimulationEvent = SimulationEvent & {
  readonly application?: ThiefSimulationEvent;
  readonly bonusAboveNinetyStacks?: number;
  readonly cancelled?: boolean;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly deadeyeMaliceSnapshot?: number;
  readonly reason?: string;
  readonly state?: Partial<ThiefState>;
  readonly triggeredByAlly?: number;
  readonly venomProcEffectIndex?: number;
};

export type ThiefResolverEvent = Gw2ResolverEvent & {
  readonly application?: ThiefResolverEvent;
  readonly bonusAboveNinetyStacks?: number;
  readonly deadeyeMaliceSnapshot?: number;
  readonly lifeSiphon?: boolean;
  readonly state?: Partial<ThiefState>;
  readonly triggeredByAlly?: number;
  readonly venomProcEffectIndex?: number;
};

export type ThiefResolverContext = Gw2ResolverRuntime & {
  config: ThiefConfig;
  profession: ThiefRuntimeState;
  readonly state?: { readonly profession: ThiefRuntimeState };
};

export interface ThiefResolverReactionDetails extends SchedulerRecord {
  readonly hitContext?: Gw2HitResolutionContext;
}

export interface ThiefEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<ThiefRuntimeState>;
  readonly resolverState?: Partial<ThiefState> | null;
}

export interface ThiefUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: ThiefConfig;
  readonly build?: ThiefBuild;
  readonly state?: {
    readonly profession?: ThiefRuntimeState | Partial<ThiefState>;
  };
  readonly professionState?: ThiefRuntimeState | Partial<ThiefState>;
  readonly initialInitiative?: number;
  readonly initialShadowForce?: number;
  readonly time?: number;
}

export interface ThiefWeaponMatcherContext extends Gw2WeaponMatcherContext {
  readonly catalog?: CanonicalCatalog<ThiefSkill> | null;
  readonly config?: ThiefConfig;
  readonly state?: {
    readonly profession?: ThiefRuntimeState | Partial<ThiefState>;
  };
  readonly professionState?: ThiefRuntimeState | Partial<ThiefState>;
  readonly specialization?: string;
}
