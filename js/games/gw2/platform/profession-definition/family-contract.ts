import type { BuildValidationResult, Gw2Build, UnvalidatedBuild } from '#gw2/platform/builds/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { NormalizedProfessionContract, ProfessionConfig } from '#gw2/platform/profession-definition/types.js';
import type {
  ProfessionRuntimeOptions,
  RuntimeProfession
} from '#gw2/platform/profession-definition/runtime-contract.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

/** Join build, compiled runtime, and lazy presentation capabilities at the profession family boundary. */

export interface ProfessionApplicationContract<TBuild extends object = object, TSkill extends Skill = Skill> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog<TSkill>;
  readonly ui: ProfessionUiContract;
  readonly createBuildDefaults: () => TBuild;
  readonly migrateBuild: (saved: UnvalidatedBuild) => TBuild;
  readonly validateBuild: (build: UnvalidatedBuild) => BuildValidationResult;
}

export interface ProfessionFamilyContract<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState> = NormalizedProfessionContract<TProfessionState>,
  TBuild extends object = object,
  TSkill extends Skill = Skill
> extends ProfessionApplicationContract<TBuild, TSkill> {
  readonly resolveProfession: (config: Readonly<ProfessionConfig>) => Readonly<TRuntime>;
}

export interface Gw2ProfessionContract<
  TProfessionState extends object = object,
  TSkill extends Skill = Skill
> extends NormalizedProfessionContract<TProfessionState, TSkill> {
  readonly projectPlanningState: (input: Gw2PlanningStateInput<TProfessionState>) => unknown;
}

/** Joins the application surface to a runtime source whose GW2 resolver callbacks remain type checked. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The application registry holds multiple profession state types; concrete sources retain their generic state.
export type Gw2ProfessionSource<TProfessionState extends object = any> = ProfessionFamilyContract<
  TProfessionState,
  Gw2ProfessionContract<TProfessionState>,
  Gw2Build
> & {
  runtimeFor(config: Gw2Config, options?: ProfessionRuntimeOptions): RuntimeProfession<TProfessionState>;
};
