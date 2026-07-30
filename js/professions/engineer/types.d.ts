import type {
  CanonicalCatalog,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  SchedulerRecord,
  SchedulerState,
  ScheduledTask,
  SimulationEvent,
  Skill,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  Gw2Build,
  Gw2CanonicalBuild,
  Gw2Config,
  Gw2EventDraft,
  Gw2HitResolutionContext,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
  Gw2Stats,
} from "../../platform/gw2/types.js";
import type {
  ProfessionApplicationBuild,
  ProfessionBuildAssumptions,
} from "../../app/profession/types.js";

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

export interface EngineerApplicationBuild
  extends ProfessionApplicationBuild {
  initialHeat: number;
  selectedMorphSkillIds: number[];
}

export interface EngineerConfig extends Gw2Config {
  readonly assumptions?: ProfessionBuildAssumptions;
  readonly inDamagingField?: boolean;
  readonly specialization?: string;
  readonly initialHeat?: number;
  readonly professionAssumptions?: ProfessionBuildAssumptions;
  readonly selectedMorphSkillIds?: readonly number[];
  readonly selectedSkills?:
    | readonly string[]
    | Readonly<Record<string, string>>;
}

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

export interface EngineerComboField extends SchedulerRecord {
  readonly startsAt: number;
  readonly expiresAt: number;
  readonly fieldType?: string;
  readonly skillId?: SkillId | null;
  readonly skillName?: string;
}

export interface EngineerState extends SchedulerRecord {
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  heat: number;
  maximumHeat: number;
  heatUpdatedAt: number;
  photonForgeActive: boolean;
  forgeExitedAt: number | null;
  overheated: boolean;
  solarFocusingLensStacks: number;
  solarFocusingLensReadyAt: number;
  solarFocusingLensUntil: number;
  enhancedCapacityMightReadyAt: number | null;
  kitLockoutUntil: number;
  activeKit: string;
  fireProjectileFinisherProgress: number;
  completedBlastFinisherActivations: Record<string, boolean>;
  activeComboFields: EngineerComboField[];
  availableFlips: Record<string, boolean>;
  autoattackChains: Record<string, SkillId>;
  mech: EngineerMechState;
  selectedMorphSkillIds: number[];
  evolvedUntil: number;
  focusedUntil: number;
  lightningRodActivationId: string;
  lightningRodChargeExpiries: number[];
  electricArtilleryAvailable: boolean;
  electricArtilleryReadyAt: number;
  electricArtilleryExpiresAt: number;
  willingHostUntil: number;
  plasmaticStateUntil: number;
  plasmaticLockoutUntil: number;
  thornsUntil: number;
  rapaciousUntil: number;
  predatorUntil: number;
  titanicUntil: number;
  berserkerUntil: number;
  activeStances: Record<string, number | boolean>;
  kineticCharges: number;
  traitProcReadyAt: Record<string, number | boolean>;
}

export interface EngineerSkill extends Skill {
  readonly aftercastMs?: number;
  readonly comboField?: string;
  readonly duration?: number;
  readonly finisherType?: string;
  readonly finisherValue?: number;
  readonly forgeSkill?: boolean;
  readonly heatGain?: number;
  readonly kit?: string | boolean;
  readonly kitName?: string;
  readonly mechanicSlot?: number;
  readonly paletteFlipSkillId?: SkillId | null;
  readonly flipParentName?: string;
  readonly quicknessAftercastMs?: number;
  readonly simulatorExcluded?: boolean;
  readonly toolbeltParentName?: string;
}

export type EngineerSchedulerContext = SchedulerContext<EngineerState> & {
  readonly catalog: CanonicalCatalog<EngineerSkill>;
  readonly config: EngineerConfig;
};

export type EngineerCastContext = CastLifecycleContext<EngineerState> & {
  readonly catalog: CanonicalCatalog<EngineerSkill>;
  readonly config: EngineerConfig;
};

export type EngineerPrecastContext = CastContext<EngineerState> & {
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
  readonly enhancedCapacityTier?: boolean;
  readonly engineerMech?: boolean;
  readonly expiresAt?: number;
  readonly fieldType?: string;
  readonly finisherType?: string;
  readonly finisherValue?: number;
  readonly mechBasicAttack?: boolean;
  readonly skillWeapon?: string;
  readonly solarFocusingLens?: boolean;
  readonly staticDischarge?: boolean;
};

export interface EngineerEndStateProjectionOptions {
  readonly schedulerState: SchedulerState<EngineerState>;
}

export type EngineerPlayerStats = Partial<Gw2Stats>;

export type EngineerScheduledTask<TPayload extends SchedulerRecord> =
  ScheduledTask<TPayload>;

export type EngineerResolverEvent = Gw2ResolverEvent & {
  readonly application?: Gw2ResolverEvent & {
    readonly engineerMech?: boolean;
  };
  readonly blastFinisher?: boolean;
  readonly charges?: number;
  readonly damageKind?: string;
  readonly engineerMech?: boolean;
  readonly enhancedCapacityTier?: boolean;
  readonly explosion?: boolean;
  readonly expiresAt?: number;
  readonly fieldType?: string;
  readonly finisherType?: string;
  readonly finisherValue?: number;
  readonly hitIndex?: number;
  readonly mechBasicAttack?: boolean;
  readonly projectile?: boolean;
  readonly state?: Partial<EngineerState>;
};

export type EngineerResolverContext = Gw2ResolverRuntime & {
  config: EngineerConfig;
  profession: EngineerState;
  readonly state?: { readonly profession: EngineerState };
};

export interface EngineerResolverReactionDetails extends SchedulerRecord {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly criticalChance?: number;
  readonly applyCondition?: (
    context: Gw2ResolverRuntime,
    event: Gw2EventDraft,
  ) => unknown;
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
  readonly entry?: {
    readonly name?: string;
  };
}

export interface EngineerUiSelection extends SchedulerRecord {
  readonly key?: string;
  readonly index?: number;
  readonly skillId?: SkillId;
}
