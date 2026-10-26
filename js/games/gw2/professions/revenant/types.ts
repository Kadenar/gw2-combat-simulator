import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2CanonicalBuild, Gw2Build } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { ConduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RenegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { VindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
/** Numeric tuning fields are typed from the modules' skill-field declarations, which also validate and patch them. */
export interface RevenantSkill
  extends
    Skill,
    NumericSkillFields<typeof REVENANT_CORE_SKILL_FIELDS>,
    NumericSkillFields<typeof CONDUIT_SKILL_FIELDS> {
  readonly affinityOnHit?: boolean;
  readonly consume?: boolean;
  readonly duration?: number;
  readonly displayName?: string;
  readonly facet?: boolean;
  readonly legendId?: string;
  readonly paletteLegendId?: string;
  readonly upkeepConsumeByLegendId?: Readonly<Record<string, SkillId>>;
  readonly upkeepPulse?: {
    readonly kind: string;
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

export interface RevenantState extends RevenantCoreState, HeraldState, RenegadeState, VindicatorState, ConduitState {
  /** Public loadout consumers use the projected legend identity; live Core state stores only activeLegendId. */
  activeLoadoutId: string;
}

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
    Partial<Pick<RevenantState, 'activeUpkeeps' | 'beguilingHazeCharges' | 'conduitForm' | 'cosmicWisdomUntil'>>
  >;
  readonly traits: ReadonlySet<SkillId>;
}

export type RevenantResolverContext = MechanicCombatContext & {
  config: RevenantConfig;
  profession: RevenantRuntimeState;
};

export interface RevenantUiContext extends Omit<
  ProfessionUiCallbackContext<Partial<RevenantState>>,
  'build' | 'cooldowns' | 'entry' | 'rotation'
> {
  readonly config?: RevenantConfig;
  readonly build?: RevenantBuild | null;
  readonly initialEnergy?: number;
  readonly cooldowns?: Readonly<Record<string, { readonly remaining?: number }>>;
  readonly entry?: unknown;
  readonly rotation?: readonly unknown[];
}

/** UI slice whose callbacks read Revenant end-state projections. */
export type RevenantUiSlice = Partial<ProfessionUiContract<Partial<RevenantState>>>;
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { CONDUIT_SKILL_FIELDS } from '#gw2/professions/revenant/specializations/conduit/skill-fields.js';
import type { REVENANT_CORE_SKILL_FIELDS } from '#gw2/professions/revenant/core/skill-fields.js';
