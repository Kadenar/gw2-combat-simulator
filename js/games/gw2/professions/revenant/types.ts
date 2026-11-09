import type { Gw2Build, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { BoonId } from '#gw2/platform/constants.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2SharedProfessionPlanningState } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { REVENANT_CORE_SKILL_FIELDS } from '#gw2/professions/revenant/core/catalog-fields.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { CONDUIT_SKILL_FIELDS } from '#gw2/professions/revenant/specializations/conduit/catalog-fields.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { VindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
/** Numeric tuning fields are typed from the modules' skill-field declarations, which also validate and patch them. */
export interface RevenantSkill
  extends
    Skill,
    NumericSkillFields<typeof REVENANT_CORE_SKILL_FIELDS>,
    NumericSkillFields<typeof CONDUIT_SKILL_FIELDS> {
  /** Grants legend affinity when the skill hits. */
  readonly affinityOnHit?: boolean;
  /** Consumes an active facet instead of starting its upkeep. */
  readonly consume?: boolean;
  /** Facet whose upkeep and consume pair this skill belongs to. */
  readonly facet?: boolean;
  /** Legend that owns this skill. */
  readonly legendId?: string;
  readonly paletteLegendId?: string;
  /** Consume skill selected by the active legend. */
  readonly upkeepConsumeByLegendId?: Readonly<Record<string, SkillId>>;
  readonly upkeepPulse?: {
    readonly kind: BoonId;
    readonly duration: number;
    readonly stacks: number;
  };
}

export interface RevenantBuild extends Gw2Build {
  specializations?: ProfessionTraitSelection[];
}

export interface RevenantCanonicalBuild extends Gw2CanonicalBuild {
  selectedLegends: string[];
  startingLegend: string;
  initialEnergy: number;
}

export interface RevenantConfig extends Gw2Config {
  readonly selectedLegends?: readonly string[];
  readonly startingLegend?: string;
  readonly initialEnergy?: number;
}

export interface RevenantTimedStack {
  at: number;
  expiresAt: number;
}

/** Public consumers receive only the ID/value pairs published by active owners. */
export type RevenantPlanningState = Gw2SharedProfessionPlanningState &
  ReturnType<typeof import('#gw2/professions/revenant/core/state.js').projectRevenantPlanningState> &
  ReturnType<typeof import('#gw2/professions/revenant/specializations/conduit/state.js').projectConduitPlanningState> &
  ReturnType<
    typeof import('#gw2/professions/revenant/specializations/renegade/state.js').projectRenegadePlanningState
  > &
  ReturnType<
    typeof import('#gw2/professions/revenant/specializations/vindicator/state.js').projectVindicatorPlanningState
  >;

export interface RevenantRuntimeState {
  core: RevenantCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Herald'; state: HeraldState }
    | { kind: 'Renegade'; state: RenegadeState }
    | { kind: 'Vindicator'; state: VindicatorState }
    | { kind: 'Conduit'; state: ConduitState };
}

/** Explicit cost inputs shared by simulation and palette calculations. */
export interface RevenantEnergyCostInput {
  readonly catalog: CanonicalCatalog;
  readonly specialization: string;
  readonly time: number;
  readonly state: ReadonlyMechanicState<
    Partial<
      Pick<
        RevenantCoreState & ConduitState,
        'activeUpkeeps' | 'beguilingHazeCharges' | 'conduitForm' | 'cosmicWisdomUntil'
      >
    >
  >;
  readonly traits: ReadonlySet<SkillId>;
}

export type RevenantResolverContext = MechanicCombatContext & {
  config: RevenantConfig;
  profession: RevenantRuntimeState;
};

export interface RevenantUiContext extends Omit<
  ProfessionUiCallbackContext<Partial<RevenantPlanningState>>,
  'build' | 'entry' | 'rotation'
> {
  readonly config?: RevenantConfig;
  readonly build?: RevenantBuild | null;
  readonly initialEnergy?: number;
  readonly entry?: unknown;
  readonly rotation?: readonly unknown[];
}

/** UI slice whose callbacks read Revenant end-state projections. */
export type RevenantUiSlice = Partial<ProfessionUiContract<Partial<RevenantPlanningState>, RevenantSkill>>;
