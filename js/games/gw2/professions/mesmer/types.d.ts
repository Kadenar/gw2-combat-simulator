import type {
  AmmoState,
  BalanceProfile,
  CanonicalCatalog,
  CastCommand,
  SchedulerContext,
  SchedulerPolicy,
  SchedulerRecord,
  SimulationEvent,
  SimulationEventInput,
  Skill,
  SkillId,
  StrikeTick
} from '#gw2/platform/engine/types.js';
import type {
  Gw2ApplicationBuild,
  Gw2Build,
  Gw2BuildAttributeRuleContext,
  Gw2CanonicalBuild
} from '#gw2/platform/builds/types.js';
import type { Gw2SelectedSkillValue } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import type { Gw2CriticalResult } from '#gw2/platform/combat/query/types.js';
import type {
  MesmerProfessionState,
  MesmerResolverState,
  MesmerRuntimeState
} from '#gw2/professions/mesmer/state/types.js';
import type {
  MesmerResourceDefinition,
  MesmerResourceSpendDetails
} from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type {
  MesmerShatter,
  MesmerShatterResolution,
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type {
  MesmerAttackStatus,
  MesmerCloneAttack,
  MesmerCloneAttackScheduler,
  MesmerDestroyClone,
  MesmerExpectedProcTracker,
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy,
  MesmerResourceController,
  MesmerTraitDamage
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import type {
  MesmerActiveEmission,
  MesmerCastDetails,
  MesmerSkillEffectController
} from '#gw2/professions/mesmer/core/execution/effect-types.js';
import type { MesmerContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/types.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';

import type {
  MesmerConditionApplication,
  MesmerDamageGroup,
  MesmerEventExtra,
  MesmerSkill
} from '#gw2/professions/mesmer/data/types.js';

export type { MesmerResourceSpendDetails } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
export type {
  MesmerShatter,
  MesmerShatterResolution,
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
export interface MesmerSpecializationSelection {
  readonly name: string;
  readonly traits?: string;
}

export interface MesmerBuild extends Gw2Build {
  specializations?: MesmerSpecializationSelection[];
  assumptions?: SchedulerRecord & {
    readonly fury?: boolean;
    readonly alacrity?: boolean;
    readonly regeneration?: boolean;
  };
  initialResource?: number;
  weaponmasterTraining?: boolean;
}

export interface MesmerCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

export interface MesmerApplicationBuild extends Gw2ApplicationBuild {
  initialResource: number;
}

export interface MesmerBuildAttributeRuleContext extends Omit<Gw2BuildAttributeRuleContext, 'build'> {
  readonly build: MesmerBuild;
}

export type MesmerSelectedSkill = Gw2SelectedSkillValue;

/** Prepared family-wide scheduler input after build normalization. */
export interface MesmerConfig extends Gw2Config {
  readonly specialization: string;
  readonly primaryWeapon: string;
  readonly weaponSet2Primary?: string;
  readonly weaponSet2Secondary?: string;
  readonly initialResource?: number;
  readonly infiniteForge?: boolean;
  readonly weaponmasterTraining?: boolean;
  readonly selectedTraitIds?: readonly SkillId[];
}

export type MesmerResolverContext = Gw2ResolverRuntime & {
  config: MesmerConfig;
  profession: MesmerResolverState;
};

export type MesmerResolverEvent = Gw2ResolverEvent & {
  readonly count?: number;
};

export type MesmerCatalog = CanonicalCatalog<MesmerSkill>;

export interface MesmerSchedulerPolicy extends SchedulerPolicy<MesmerRuntimeState> {
  critical(context: SchedulerContext<MesmerRuntimeState>, event: SimulationEvent): Gw2CriticalResult;
  isCombatActive(): boolean;
  combatBeganAt(): number | null;
  requireCriticalFacts(): void;
}

export type MesmerSchedulerContext = Omit<
  SchedulerContext<MesmerRuntimeState>,
  'config' | 'catalog' | 'schedulerPolicy'
> & {
  readonly config: MesmerConfig;
  readonly catalog: MesmerCatalog;
  readonly schedulerPolicy: MesmerSchedulerPolicy;
  mesmerRuntime?: MesmerRuntime;
};

export type MesmerHandlerContext = MesmerSchedulerContext & {
  readonly mesmerRuntime: MesmerRuntime;
};

export type MesmerPrecastContext = MesmerSchedulerContext & {
  readonly command: CastCommand;
  readonly commandIndex: number;
  readonly skill: MesmerSkill;
  readonly start: number;
  readonly ammo: AmmoState | null;
};

export type MesmerCastContext = MesmerPrecastContext & {
  readonly action: SimulationEvent;
  readonly fullEnd: number;
  readonly effectiveEnd: number;
  readonly rechargeDuration: number;
  readonly ammoLockoutDuration: number;
  readonly rechargeStart: number;
  readonly rechargeReadyAt: number | null;
  readonly reservationId: string;
};

/** Scheduler-local dependencies assembled once for the active Mesmer module. */
export interface MesmerRuntime {
  context: MesmerSchedulerContext;
  traits: ReadonlySet<number>;
  resourceDefinition: MesmerResourceDefinition;
  skillsById: ReadonlyMap<SkillId, MesmerSkill>;
  flipSkillsByParent: ReadonlyMap<SkillId, MesmerSkill>;
  activeEmission: MesmerActiveEmission | null;
  castDetails: Map<string, MesmerCastDetails>;
  weaponStrength: Readonly<Record<string, number>>;
  cloneAttacks: Readonly<Record<string, MesmerCloneAttack>>;
  ambushAttacks: Record<string, MesmerAmbushAttack>;
  phantasmAttackTimings: Record<number, MesmerPhantasmAttackTiming>;
  phantasmPolicy: MesmerPhantasmPolicy;
  traitDamage: Record<string, MesmerTraitDamage>;
  shatters: Record<number, MesmerShatter>;
  shatterResolvers: Record<string, MesmerShatterResolver>;
  shatterResolvedHandlers: MesmerShatterResolvedHandler[];
  skillCompletionHandlers: MesmerSkillCompletionHandler[];
  instruments: Record<number, MesmerInstrument>;
  balanceProfile: (id: SkillId) => BalanceProfile | undefined;
  controlSkills: Set<number>;
  blindSkills: Set<number>;
  aristocracySkills: Set<number>;
  peithaSkills: Set<number>;
  peithaProjectileDelays: Record<number, number>;
  activePrimaryWeapon: MesmerActivePrimaryWeapon;
  addEvent: MesmerAddEvent;
  addTraitProc: MesmerAddTraitProc;
  addCondition: MesmerAddCondition;
  addDamage: MesmerAddDamage;
  cloneAttackScheduler: MesmerCloneAttackScheduler;
  destroyClone: MesmerDestroyClone;
  resources: MesmerResourceController;
  expected: MesmerExpectedProcTracker;
  actions: MesmerProfessionActionController;
  continuum?: MesmerContinuumController;
  mirage?: MesmerMirageController;
  skillEffects: MesmerSkillEffectController;
}

export interface MesmerUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: Partial<MesmerConfig>;
  readonly build?: Partial<MesmerBuild>;
  readonly catalog?: CanonicalCatalog;
  readonly state?: { readonly profession?: Partial<MesmerProfessionState> };
  readonly professionState?: Partial<MesmerProfessionState>;
  readonly value?: number;
}

export interface MesmerAmbushStrike {
  readonly coefficient?: number;
  readonly hits?: number;
  readonly atMs?: number;
  readonly castTimeMs?: number;
  readonly damageAtMs?: number;
  readonly ticks?: readonly StrikeTick[];
  readonly conditions?: readonly MesmerAttackStatus[];
}

export interface MesmerAmbushAttack {
  readonly balanceProfileId?: SkillId;
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly castTimeMs: number;
  readonly cooldown: number;
  readonly player: MesmerAmbushStrike;
  readonly clone: MesmerAmbushStrike;
  readonly playerBoons?: readonly MesmerAttackStatus[];
  readonly cloneBoons?: readonly MesmerAttackStatus[];
  readonly vulnerability?: {
    readonly duration: number;
    readonly stacks: number;
  };
  readonly createsClone?: boolean;
  readonly control?: boolean;
}

export interface MesmerInstrument {
  readonly balanceProfileId?: SkillId;
  readonly slot: number;
  readonly instrument: string;
  readonly coefficient?: number;
  readonly hits?: number;
  readonly damageAtMs?: number;
  readonly ticks?: readonly StrikeTick[];
  readonly conditions?: readonly MesmerAttackStatus[];
}

export type MesmerShatterResolver = (
  context: MesmerCastContext,
  request: MesmerShatterResolverRequest
) => readonly MesmerShatterTraitHit[];

export type MesmerSkillCompletionHandler = (
  context: MesmerCastContext,
  skill: MesmerSkill,
  at: number
) => boolean | MesmerShatterResolution;

export type MesmerShatterResolvedHandler = (context: MesmerCastContext, resolution: MesmerShatterResolution) => void;

export type MesmerAddEvent = (
  event: SchedulerRecord & {
    readonly type: string;
    readonly at: number;
    readonly source?: string;
    readonly sourceId?: SkillId;
  }
) => SimulationEvent | null;

export type MesmerAddTraitProc = (
  name: string,
  at: number,
  sourceSkill?: string,
  detail?: string
) => SimulationEvent | null;

export type MesmerAddCondition = (
  skillName: string,
  at: number,
  condition: MesmerConditionApplication,
  source?: string,
  label?: string,
  extra?: MesmerEventExtra
) => readonly SimulationEvent[];

export type MesmerAddDamage = (
  skill: Skill,
  at: number,
  group: MesmerDamageGroup,
  extra?: MesmerEventExtra
) => readonly SimulationEvent[];

export type MesmerActivePrimaryWeapon = () => string;

export interface MesmerProfessionActionController {
  commitReservedResources(at: number, reserved: number, details?: MesmerResourceSpendDetails): number;
  consumeResources(at: number, details?: MesmerResourceSpendDetails): number;
  currentResource(): number;
  handleShatter(
    context: MesmerCastContext,
    skill: MesmerSkill,
    at: number,
    resourcesSpent?: number | null,
    castStart?: number
  ): MesmerShatterResolution | null;
  reserveResources(): number;
  restoreReservedResources(spent: number): void;
  triggerShatterTraits(resolution: MesmerShatterResolution): void;
}

export type MesmerEmitDerivedEvent = (cause: SimulationEvent, event: SimulationEventInput) => unknown;
export type MesmerRefreshAmmo = (skill: MesmerSkill, at: number) => AmmoState | null;

export interface MesmerRechargeContext extends SchedulerRecord {
  readonly skill: MesmerSkill;
  readonly config: MesmerConfig;
  readonly ammoCastLockout?: boolean;
  readonly mesmerRuntime?: MesmerRuntime;
}

export interface MesmerMaximumAmmoContext extends SchedulerRecord {
  readonly skill: MesmerSkill;
  readonly mesmerRuntime?: MesmerRuntime;
}
