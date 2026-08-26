import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  RotationCommand,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  ScheduledTask,
  SimulationEvent,
  Skill,
  SkillId
} from '../../platform/engine/types.js';
import type { Gw2Build, Gw2CanonicalBuild, Gw2NumericAttributes } from '../../platform/gw2/builds/types.js';
import type { Gw2Config } from '../../platform/gw2/simulation/config.js';
import type {
  Gw2HitResolutionContext,
  Gw2ResolverEvent,
  Gw2ResolverRuntime
} from '../../platform/gw2/resolver/types.js';
import type { Gw2Stats } from '../../platform/gw2/equipment/types.js';
import type { ProfessionApplicationBuild, ProfessionBuildAssumptions } from '../../app/profession/types.js';

export interface EngineerSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

export interface EngineerBuild extends Gw2Build {
  specializations?: EngineerSpecializationSelection[];
  assumptions?: ProfessionBuildAssumptions;
  initialHeat?: number;
  selectedMorphSkillIds?: number[];
  selectedSkills?: readonly string[] | Record<string, string>;
}

export interface EngineerCanonicalBuild extends Gw2CanonicalBuild {
  assumptions: SchedulerRecord;
  initialHeat: number;
  selectedMorphSkillIds: number[];
}

export interface EngineerApplicationBuild extends ProfessionApplicationBuild {
  initialHeat: number;
  selectedMorphSkillIds: number[];
}

export interface EngineerConfig extends Gw2Config {
  readonly amalgamEvolveAttributePool?: EngineerEvolveAttributePool;
  readonly assumptions?: ProfessionBuildAssumptions;
  readonly inDamagingField?: boolean;
  readonly specialization?: string;
  readonly initialHeat?: number;
  readonly professionAssumptions?: ProfessionBuildAssumptions;
  readonly selectedMorphSkillIds?: readonly number[];
  readonly selectedSkills?: readonly string[] | Readonly<Record<string, string>>;
}

export type EngineerEvolveAttributePool = Readonly<Gw2NumericAttributes>;

export interface EngineerMechAttributes extends SchedulerRecord {
  power: number;
  precision: number;
  toughness: number;
  vitality: number;
  ferocity: number;
  conditionDamage: number;
  expertise: number;
  concentration: number;
  healingPower: number;
}

export interface EngineerMechState extends SchedulerRecord {
  enabled: boolean;
  active: boolean;
  commandSkillIds: SkillId[];
  nextAttackAt: number | null;
  busyUntil: number;
  attributes: EngineerMechAttributes | null;
}

export interface EngineerCoreState {
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  activeKit: string;
  availableFlips: Record<string, boolean>;
  autoattackChains: Record<string, SkillId>;
  focusedUntil: number;
  lightningRodActivationId: string;
  lightningRodChargeExpiries: number[];
  electricArtilleryAvailable: boolean;
  electricArtilleryReadyAt: number;
  electricArtilleryExpiresAt: number;
  kineticCharges: number;
  traitProcReadyAt: Record<string, number | boolean>;
}

export interface ScrapperState {
  kineticAcceleratorsWhirlReadyAt: number;
}

export interface HolosmithState {
  heat: number;
  maximumHeat: number;
  heatUpdatedAt: number;
  passiveHeatAt: number | null;
  photonForgeActive: boolean;
  forgeExitedAt: number | null;
  overheated: boolean;
  solarFocusingLensStacks: number;
  solarFocusingLensReadyAt: number;
  solarFocusingLensUntil: number;
  enhancedCapacityMightReadyAt: number | null;
  kitLockoutUntil: number;
}

export interface MechanistState {
  mech: EngineerMechState;
}

export interface AmalgamState {
  selectedMorphSkillIds: number[];
  evolvedUntil: number;
  willingHostUntil: number;
  plasmaticStateUntil: number;
  thornsUntil: number;
  rapaciousUntil: number;
  predatorUntil: number;
  titanicUntil: number;
  berserkerUntil: number;
  activeStances: Record<string, number | boolean>;
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
  readonly engineerMech?: boolean;
  readonly expiresAt?: number;
  readonly fieldType?: string;
  readonly mechBasicAttack?: boolean;
  readonly skillWeapon?: string;
  readonly staticDischarge?: boolean;
};

export interface EngineerEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<EngineerRuntimeState>;
}

export type EngineerPlayerStats = Partial<Gw2Stats>;

export type EngineerScheduledTask<TPayload extends SchedulerRecord> = ScheduledTask<TPayload>;

export type EngineerResolverEvent = Gw2ResolverEvent & {
  readonly application?: Gw2ResolverEvent & {
    readonly engineerMech?: boolean;
  };
  readonly charges?: number;
  readonly damageKind?: string;
  readonly engineerMech?: boolean;
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

export interface EngineerResolverReactionDetails extends SchedulerRecord {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly criticalChance?: number;
}

export interface EngineerUiContext extends SchedulerRecord {
  readonly specialization?: string;
  readonly config?: EngineerConfig;
  readonly build?: EngineerBuild;
  readonly state?: {
    readonly profession?: Partial<EngineerState>;
  };
  readonly professionState?: Partial<EngineerState>;
  readonly initialHeat?: number;
  readonly skill?: EngineerSkill;
  readonly weaponLine?: string | null;
  readonly entry?: RotationCommand;
}

export interface EngineerUiSelection extends SchedulerRecord {
  readonly key?: string;
  readonly index?: number;
  readonly skillId?: SkillId;
}
