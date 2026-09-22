import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerState
} from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type {
  Gw2CanonicalBuild,
  Gw2Build,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
  ProfessionBuildAssumptions
} from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';
import type { EngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import type { AmalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { HolosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import type { MechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { ScrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
export interface EngineerBuild extends Gw2Build {
  specializations?: ProfessionTraitSelection[];
  selectedSkills?: readonly string[] | Record<string, string>;
}

export interface EngineerCanonicalBuild extends Gw2CanonicalBuild {
  initialHeat: number;
  selectedMorphSkillIds: number[];
}

export interface EngineerConfig extends Gw2Config {
  readonly amalgamEvolveAttributePool?: Readonly<Gw2NumericAttributes>;
  readonly assumptions?: ProfessionBuildAssumptions;
  readonly inDamagingField?: boolean;
  readonly initialHeat?: number;
  readonly professionAssumptions?: ProfessionBuildAssumptions;
  readonly selectedMorphSkillIds?: readonly number[];
}

export interface EngineerState extends EngineerCoreState, ScrapperState, HolosmithState, MechanistState, AmalgamState {}

export interface EngineerRuntimeState {
  core: EngineerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Scrapper'; state: ScrapperState }
    | { kind: 'Holosmith'; state: HolosmithState }
    | { kind: 'Mechanist'; state: MechanistState }
    | { kind: 'Amalgam'; state: AmalgamState };
}

export interface EngineerSkill extends Skill {
  readonly countsAsToolbeltSkill?: boolean;
  readonly duration?: number;
  readonly kit?: string | boolean;
  readonly kitName?: string;
  readonly mechanicSlot?: number;
  readonly paletteFlipSkillId?: SkillId | null;
  readonly flipParentName?: string;
  readonly simulatorExcluded?: boolean;
  readonly toolbeltParentId?: SkillId | null;
  readonly toolbeltParentName?: string;
}

export type EngineerSchedulerContext = SchedulerContext<EngineerRuntimeState> & {
  readonly catalog: CanonicalCatalog<EngineerSkill>;
  readonly config: EngineerConfig;
};

export type EngineerCastContext = CastLifecycleContext<EngineerRuntimeState> & {
  readonly catalog: CanonicalCatalog<EngineerSkill>;
  readonly config: EngineerConfig;
};

export type EngineerPrecastContext = CastContext<EngineerRuntimeState> & {
  readonly catalog: CanonicalCatalog<EngineerSkill>;
  readonly config: EngineerConfig;
};

export type EngineerMaximumAmmoContext = EngineerSchedulerContext & {
  readonly skill?: EngineerSkill;
};

export type EngineerRechargeContext = EngineerSchedulerContext & {
  readonly skill?: EngineerSkill;
  readonly start?: number;
};

export type EngineerSimulationEvent = SimulationEvent & {
  readonly application?: EngineerSimulationEvent;
  readonly cancelled?: boolean;
  readonly coefficient?: number;
  readonly condition?: string;
  readonly endsAt?: number;
  readonly expiresAt?: number;
  readonly fieldType?: string;
  readonly mechBasicAttack?: boolean;
  readonly skillWeapon?: string;
  readonly staticDischarge?: boolean;
};

export interface EngineerPlanningStateProjectionOptions {
  readonly schedulerState: SchedulerState<EngineerRuntimeState>;
}

export type EngineerResolverEvent = Gw2ResolverEvent & {
  readonly application?: Gw2ResolverEvent;
  readonly charges?: number;
  readonly damageKind?: string;
  readonly explosion?: boolean;
  readonly expiresAt?: number;
  readonly fieldType?: string;
  readonly hitIndex?: number;
  readonly mechBasicAttack?: boolean;
  readonly projectile?: boolean;
  readonly state?: Partial<EngineerState>;
};

export type EngineerResolverContext = Gw2ResolverRuntime & {
  config: EngineerConfig;
  profession: EngineerRuntimeState;
  readonly state?: { readonly profession: EngineerRuntimeState };
};

/** Engineer's finalized attributes also carry the pre-profession conversion pool Amalgam evolves from. */
export interface EngineerFinalizedAttributeResult extends Gw2FinalizedAttributeResult {
  readonly amalgamEvolveAttributePool?: Readonly<Gw2NumericAttributes>;
}

/** Modifier context whose config is the Engineer's, so rules can read its build selections. */
export interface EngineerModifierContext extends Gw2ModifierContext {
  readonly config?: EngineerConfig;
}

export interface EngineerUiContext extends Omit<
  ProfessionUiCallbackContext<Partial<EngineerState>>,
  'build' | 'skill'
> {
  readonly config?: EngineerConfig;
  readonly build?: EngineerBuild | null;
  readonly state?: {
    readonly profession?: Partial<EngineerState>;
  };
  readonly initialHeat?: number;
  readonly skill?: EngineerSkill;
}

/** UI slice whose callbacks read Engineer end-state projections. */
export type EngineerUiSlice = Partial<ProfessionUiContract<Partial<EngineerState>>>;

export interface EngineerUiSelection {
  readonly key?: string;
  readonly index?: number;
  readonly skillId?: SkillId;
}
