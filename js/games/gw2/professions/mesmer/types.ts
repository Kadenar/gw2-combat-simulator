import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { BalanceProfile, Skill, SkillId, StrikeTick, StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2CanonicalBuild, Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { AmmoState } from '#gw2/platform/execution/types.js';
import type { MesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import type { MesmerChronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerMirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type { MesmerTroubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerVirtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import type { MesmerProjectedInstrument } from '#gw2/professions/mesmer/specializations/troubadour/types.js';
import type {
  MesmerCloneAttack,
  MesmerCloneAttackScheduler,
  MesmerDestroyClone,
  MesmerCriticalTraitDispatcher,
  MesmerPhantasmAttackTiming,
  MesmerPhantasmPolicy,
  MesmerResourceController,
  MesmerTraitDamage
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
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
  MesmerActiveEmission,
  MesmerCastDetails,
  MesmerSkillEffectController
} from '#gw2/professions/mesmer/core/execution/effect-types.js';
import type { MesmerContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/types.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';

import type {
  MesmerConditionApplication,
  MesmerStrikeEffect,
  MesmerEventExtra,
  MesmerSkill
} from '#gw2/professions/mesmer/data/types.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export interface MesmerProfessionState
  extends MesmerCoreState, MesmerChronomancerState, MesmerMirageState, MesmerVirtuosoState, MesmerTroubadourState {}

export interface MesmerRuntimeState {
  core: MesmerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Chronomancer'; state: MesmerChronomancerState }
    | { kind: 'Mirage'; state: MesmerMirageState }
    | { kind: 'Virtuoso'; state: MesmerVirtuosoState }
    | { kind: 'Troubadour'; state: MesmerTroubadourState };
}

export interface MesmerPlanningState {
  readonly endurance?: number;
  readonly maximumEndurance?: number;
  readonly resource: number;
  readonly resourceDefinition: MesmerResourceDefinition;
  readonly clarityRemaining: number;
  readonly availableAmbush: {
    readonly name: string;
    readonly source: string;
    readonly expiresAt: number;
    readonly remaining: number;
  } | null;
  readonly availableMirrors?: number;
  readonly activeInstruments?: readonly MesmerProjectedInstrument[];
  readonly availableFlips: Readonly<SkillFlipWindows>;
  readonly autoattackChains: Readonly<Record<string, SkillId>>;
  readonly continuumActive: boolean;
  readonly continuumRemaining: number;
}

export interface MesmerSpecializationSelection {
  readonly name: string;
  readonly traits?: string;
}

export interface MesmerBuild extends Gw2Build {
  specializations?: MesmerSpecializationSelection[];
}

export interface MesmerCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

/** Prepared family-wide simulation input after build normalization. */
export interface MesmerConfig extends Gw2Config {
  readonly specialization: string;
  readonly primaryWeapon: string;
}

export type MesmerResolverContext = Gw2ResolverRuntime & {
  config: Gw2Config;
  profession: MesmerRuntimeState;
};

export type MesmerResolverEvent = Gw2ResolverEvent & {
  readonly count?: number;
  readonly conversionTimes?: readonly number[];
};

/** All mechanic owners mutate the shared live runtime. */
export type MesmerRuntime = Gw2Runtime<MesmerRuntimeState>;

/** Scheduler-local dependencies assembled once for the active Mesmer module. */
export interface MesmerMechanics {
  context: MesmerRuntime;
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
  activePrimaryWeapon: MesmerActivePrimaryWeapon;
  addEvent: MesmerAddEvent;
  addTraitProc: MesmerAddTraitProc;
  addCondition: MesmerAddCondition;
  addDamage: MesmerAddDamage;
  cloneAttackScheduler: MesmerCloneAttackScheduler;
  destroyClone: MesmerDestroyClone;
  resources: MesmerResourceController;
  criticalTraits: MesmerCriticalTraitDispatcher;
  actions: MesmerProfessionActionController;
  continuum?: MesmerContinuumController;
  mirage?: MesmerMirageController;
  skillEffects: MesmerSkillEffectController;
}

/** UI callbacks read both live state and the named public projection fields. */
export type MesmerUiState = Partial<MesmerProfessionState> &
  Partial<Omit<MesmerPlanningState, keyof MesmerProfessionState>>;

export interface MesmerUiContext extends Omit<ProfessionUiCallbackContext<MesmerUiState>, 'build'> {
  readonly config?: Partial<MesmerConfig>;
  readonly build?: Partial<MesmerBuild> | null;
  readonly state?: { readonly profession?: MesmerUiState };
}

/** UI slice whose callbacks read Mesmer end-state projections. */
export type MesmerUiSlice = Partial<ProfessionUiContract<Partial<MesmerProfessionState>>>;

export interface MesmerAmbushStrike extends Partial<StrikeEffect> {
  readonly coefficient?: number;
  readonly hits?: number;
  readonly atMs?: number;
  readonly castTimeMs?: number;
  readonly damageAtMs?: number;
  /** Repeated statuses retain their cadence when their sibling strike is removed. */
  readonly statusAtMs?: readonly number[];
  readonly ticks?: readonly StrikeTick[];
  readonly conditions?: readonly MesmerConditionApplication[];
  readonly boons?: readonly MesmerConditionApplication[];
}

/** A catalog skill also supplies the player and clone variants used by the Mirage controller. */
export interface MesmerAmbushAttack extends MesmerSkill {
  readonly balanceProfileId?: SkillId;
  readonly player: MesmerAmbushStrike;
  readonly clone: MesmerAmbushStrike;
  readonly vulnerability?: {
    readonly duration: number;
    readonly stacks: number;
  };
  readonly createsClone?: boolean;
}

export interface MesmerInstrument extends Partial<StrikeEffect> {
  readonly balanceProfileId?: SkillId;
  readonly slot: number;
  readonly instrument: string;
  readonly coefficient?: number;
  readonly hits?: number;
  readonly damageAtMs?: number;
  /** Launched performance packets can outlive an interruption after the skill's commit point. */
  readonly persistsAfterInterrupt?: boolean;
  readonly ticks?: readonly StrikeTick[];
  readonly conditions?: readonly MesmerConditionApplication[];
}

export type MesmerShatterResolver = (
  context: MesmerRuntime,
  request: MesmerShatterResolverRequest
) => readonly MesmerShatterTraitHit[];

export type MesmerSkillCompletionHandler = (
  context: MesmerRuntime,
  cast: RuntimeCast,
  skill: MesmerSkill,
  at: number
) => boolean | MesmerShatterResolution;

export type MesmerShatterResolvedHandler = (context: MesmerRuntime, resolution: MesmerShatterResolution) => void;

export type MesmerAddEvent = (
  event: MesmerEventExtra & {
    readonly type: string;
    readonly at: number;
    /** Instrument lifecycle events retain their payload; combat annotations belong in metadata. */
    readonly instrument?: string;
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
  group: Partial<MesmerStrikeEffect>,
  extra?: MesmerEventExtra
) => readonly SimulationEvent[];

export type MesmerActivePrimaryWeapon = () => string;

export interface MesmerProfessionActionController {
  commitReservedResources(at: number, reserved: number, details?: MesmerResourceSpendDetails): number;
  consumeResources(at: number, details?: MesmerResourceSpendDetails): number;
  currentResource(): number;
  handleShatter(
    context: MesmerRuntime,
    skill: MesmerSkill,
    at: number,
    resourcesSpent?: number | null,
    castStart?: number
  ): MesmerShatterResolution | null;
  reserveResources(): number;
  restoreReservedResources(spent: number): void;
  triggerShatterTraits(resolution: MesmerShatterResolution): void;
}

export type MesmerEmitDerivedEvent = (cause: SimulationEvent, event: SimulationEventBase) => unknown;
export type MesmerRefreshAmmo = (skill: MesmerSkill, at: number) => AmmoState | null;
