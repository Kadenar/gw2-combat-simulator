import type { Gw2Build, Gw2CanonicalBuild, ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { MechanicCombatContext, MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { RANGER_CORE_SKILL_FIELDS } from '#gw2/professions/ranger/core/catalog-fields.js';
import type { RangerCoreState } from '#gw2/professions/ranger/core/state.js';
import type { DruidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import type { GALESHOT_SKILL_FIELDS } from '#gw2/professions/ranger/specializations/galeshot/catalog-fields.js';
import type { GaleshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import type { SoulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import type { RangerInitialUntamedState, UntamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';

export interface RangerBuild extends Gw2Build {
  specializations?: ProfessionTraitSelection[];
  initialUntamedState?: RangerInitialUntamedState;
}

export interface RangerCanonicalBuild extends Gw2CanonicalBuild {
  initialAstralForce: number;
  initialArrows: number;
  selectedPet: string;
  selectedPet2: string;
  selectedHammerSkillIds: number[];
  initialUntamedState: RangerInitialUntamedState;
}

export interface RangerConfig extends Gw2Config {
  readonly specializations?: readonly (string | { readonly name?: string })[];
  readonly initialAstralForce?: number;
  readonly initialArrows?: number;
  readonly selectedPet?: string;
  readonly selectedPet2?: string;
  readonly selectedHammerSkillIds?: readonly number[];
  readonly initialUntamedState?: RangerInitialUntamedState;
  readonly assumptions?: ProfessionBuildAssumptions;
  readonly professionAssumptions?: ProfessionBuildAssumptions;
}

export interface RangerPetDefinition {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly family: string;
  readonly archetype: string;
  readonly skillIds: readonly SkillId[];
  readonly beastmodeSkillIds: readonly SkillId[];
}

/** Public consumers receive only the ID/value pairs published by active owners. */
export type RangerPlanningState = ReturnType<
  typeof import('#gw2/professions/ranger/core/state.js').projectRangerCoreState
> &
  ReturnType<typeof import('#gw2/professions/ranger/specializations/druid/state.js').projectDruidPlanningState> &
  ReturnType<typeof import('#gw2/professions/ranger/specializations/galeshot/state.js').projectGaleshotPlanningState> &
  ReturnType<
    typeof import('#gw2/professions/ranger/specializations/soulbeast/state.js').projectSoulbeastPlanningState
  > &
  ReturnType<typeof import('#gw2/professions/ranger/specializations/untamed/state.js').projectUntamedPlanningState>;

export interface RangerRuntimeState {
  core: RangerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Druid'; state: DruidState }
    | { kind: 'Soulbeast'; state: SoulbeastState }
    | { kind: 'Untamed'; state: UntamedState }
    | { kind: 'Galeshot'; state: GaleshotState };
}

export type RangerResolverContext = MechanicCombatContext &
  Pick<RangerRuntime, 'fireTrigger'> & {
    config: RangerConfig;
    profession: RangerRuntimeState;
  };

/** Live Ranger owners share one combat state and retain Ranger skill fields in casts and catalog lookups. */
export type RangerRuntime = MechanicContext<RangerRuntimeState, RangerSkill> & { readonly config: RangerConfig };

/** Numeric tuning fields are typed from the modules' skill-field declarations, which also validate and patch them. */
export interface RangerSkill
  extends Skill, NumericSkillFields<typeof GALESHOT_SKILL_FIELDS>, NumericSkillFields<typeof RANGER_CORE_SKILL_FIELDS> {
  readonly petSkill?: boolean;
  readonly petFamilySkill?: boolean;
  readonly petAutonomousSkill?: boolean;
  readonly celestialAvatarSkill?: boolean;
  readonly beastmodeSkill?: boolean;
  readonly unleashedPetSkill?: boolean;
  readonly unleashedAmbushSkill?: boolean;
  readonly cycloneBowSkill?: boolean;
  readonly petNames?: readonly string[];
}

/** Modifier context whose config is the Ranger's, so rules can read its pet selection. */
export interface RangerModifierContext extends Gw2ModifierContext {
  readonly config?: RangerConfig;
}

export interface RangerUiContext extends Omit<ProfessionUiCallbackContext<Partial<RangerPlanningState>>, 'build'> {
  readonly config?: RangerConfig;
  readonly build?: RangerBuild | null;
  readonly initialAstralForce?: number;
  readonly initialArrows?: number;
  readonly selectedPet2?: string;
}

/** UI slice whose callbacks read Ranger end-state projections. */
export type RangerUiSlice = Partial<ProfessionUiContract<Partial<RangerPlanningState>>>;

export interface RangerUiSelection {
  readonly key?: string;
  readonly index?: number;
  readonly skillId?: SkillId;
  readonly value?: string;
}
