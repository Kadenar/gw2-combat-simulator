import type { Gw2Build, Gw2BuildSpecialization, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicCombatContext, MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { NECROMANCER_CORE_SKILL_FIELDS } from '#gw2/professions/necromancer/core/catalog-fields.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { HARBINGER_SKILL_FIELDS } from '#gw2/professions/necromancer/specializations/harbinger/catalog-fields.js';
import type { HarbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type { ReaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';
import type { RITUALIST_SKILL_FIELDS } from '#gw2/professions/necromancer/specializations/ritualist/catalog-fields.js';
import type { RitualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { SCOURGE_SKILL_FIELDS } from '#gw2/professions/necromancer/specializations/scourge/catalog-fields.js';
import type { ScourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';

// Module state is declared beside each state factory; re-export it for existing family type importers.
interface NecromancerBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkillIds?: Record<string, SkillId | null>;
}

export interface NecromancerCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
  initialBlight: number;
  initialCascadingCorruptionStacks: number;
}

export interface NecromancerConfig extends Gw2Config {
  readonly initialBlight?: number;
  readonly initialCascadingCorruptionStacks?: number;
  readonly duration?: number;
  readonly professionAssumptions?: Readonly<Record<string, unknown>>;
}

/** Public consumers receive only the ID/value pairs published by active owners. */
export type NecromancerPlanningState = ReturnType<
  typeof import('#gw2/professions/necromancer/core/state.js').projectNecromancerPlanningState
> &
  ReturnType<
    typeof import('#gw2/professions/necromancer/specializations/harbinger/state.js').projectHarbingerPlanningState
  > &
  ReturnType<typeof import('#gw2/professions/necromancer/specializations/ritualist/state.js').projectRitualistState> &
  ReturnType<
    typeof import('#gw2/professions/necromancer/specializations/scourge/state.js').projectScourgePlanningState
  >;

export interface NecromancerRuntimeState {
  core: NecromancerCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Reaper'; state: ReaperState }
    | { kind: 'Scourge'; state: ScourgeState }
    | { kind: 'Harbinger'; state: HarbingerState }
    | { kind: 'Ritualist'; state: RitualistState };
}

/** Actual mechanics share one owned family state and one live clock. */
export type NecromancerRuntime = MechanicContext<NecromancerRuntimeState, NecromancerSkill>;

/** Numeric tuning fields are typed from the modules' skill-field declarations, which also validate and patch them. */
export interface NecromancerSkill
  extends
    Skill,
    NumericSkillFields<
      typeof NECROMANCER_CORE_SKILL_FIELDS &
        typeof HARBINGER_SKILL_FIELDS &
        typeof SCOURGE_SKILL_FIELDS &
        typeof RITUALIST_SKILL_FIELDS
    > {
  readonly shroud?: string;
  readonly shroudEntry?: string;
  readonly shroudExit?: string;
  readonly shroudTuning?: { readonly kind: 'skill' | 'trait'; readonly id: SkillId };
  readonly usableInShroud?: boolean;
  readonly shroudSlot?: number;
  readonly slotSelectable?: boolean;
}

export type NecromancerResolverEvent = Gw2ResolverEvent & {
  readonly application?: NecromancerResolverEvent;
  readonly summonOwner?: string;
  readonly summonCriticalChance?: number;
  readonly summonCriticalDamage?: number;
  readonly mode?: string;
  readonly allyStacks?: number;
  readonly spell?: string;
  readonly controlKind?: string;
  readonly effectiveDuration?: number;
};

export type NecromancerResolverContext = MechanicCombatContext & {
  config: NecromancerConfig;
  profession: NecromancerRuntimeState;
};

/** Presentation includes the projected Blight count; live mechanics own only its expiry array. */
export interface NecromancerUiState extends Partial<NecromancerPlanningState> {
  readonly blight?: number;
}

export interface NecromancerUiContext extends Omit<ProfessionUiCallbackContext<NecromancerUiState>, 'build'> {
  readonly config?: NecromancerConfig;
  readonly build?: NecromancerBuild | null;
}

/** UI slice whose callbacks read Necromancer end-state projections. */
export type NecromancerUiSlice = Partial<ProfessionUiContract<NecromancerUiState>>;
