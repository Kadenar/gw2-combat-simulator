import type { PARAGON_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/paragon/catalog-fields.js';
import type { BERSERKER_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/berserker/catalog-fields.js';
import type { MechanicCombatContext, MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { Gw2Build, Gw2BuildSpecialization, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

import type { WarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import type { BerserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { SpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { BladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { ParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { WARRIOR_CORE_SKILL_FIELDS } from '#gw2/professions/warrior/core/catalog-fields.js';
import type { BLADESWORN_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/bladesworn/catalog-fields.js';

interface WarriorBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkillIds?: Record<string, SkillId | null>;
}

export interface WarriorCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

/** Public consumers receive only the ID/value pairs published by active owners. */
export type WarriorPlanningState = ReturnType<
  typeof import('#gw2/professions/warrior/core/state.js').projectWarriorCorePlanningState
> &
  ReturnType<
    typeof import('#gw2/professions/warrior/specializations/berserker/state.js').projectBerserkerPlanningState
  > &
  ReturnType<
    typeof import('#gw2/professions/warrior/specializations/spellbreaker/state.js').projectSpellbreakerPlanningState
  > &
  ReturnType<
    typeof import('#gw2/professions/warrior/specializations/bladesworn/state.js').projectBladeswornPlanningState
  > &
  ReturnType<typeof import('#gw2/professions/warrior/specializations/paragon/state.js').projectParagonPlanningState>;

export interface WarriorRuntimeState {
  core: WarriorCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Berserker'; state: BerserkerState }
    | { kind: 'Spellbreaker'; state: SpellbreakerState }
    | { kind: 'Bladesworn'; state: BladeswornState }
    | { kind: 'Paragon'; state: ParagonState };
}

/** Numeric tuning fields are typed from the modules' skill-field declarations, which also validate and patch them. */
export interface WarriorSkill
  extends
    Skill,
    NumericSkillFields<
      typeof WARRIOR_CORE_SKILL_FIELDS &
        typeof BLADESWORN_SKILL_FIELDS &
        typeof BERSERKER_SKILL_FIELDS &
        typeof PARAGON_SKILL_FIELDS
    > {
  /**
   * Measured cast duration (ms) while Dual Wielding and Quickness are active.
   * Only skills with this value receive a Dual Wielding cast-time adjustment.
   */
  readonly dualWieldCastTimeMs?: number;
  /** Fixed commit cutoff while Dual Wielding is active; independent of cast-duration scaling. */
  readonly dualWieldInterruptCommitMs?: number;
  /** Measured cast-start packet offsets keyed by authored offset; replaces proportional scaling for this skill. */
  readonly dualWieldEffectOffsetsMs?: Readonly<Record<number, number>>;
  readonly burst?: boolean;
  readonly primalBurst?: boolean;
  readonly gunsaberSkill?: boolean;
  readonly dragonTriggerSkill?: boolean;
  readonly movementSkill?: boolean;
  readonly dragonSlash?: boolean;
}

/** Shared full mechanic context; read-only and resolver consumers retain their narrower capabilities. */
export type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

export type WarriorResolverContext = MechanicCombatContext & {
  profession: WarriorRuntimeState;
};

export interface WarriorUiContext extends Omit<ProfessionUiCallbackContext<Partial<WarriorPlanningState>>, 'build'> {
  readonly config?: Gw2Config;
  readonly build?: WarriorBuild | null;
}

/** UI slice whose callbacks read Warrior end-state projections. */
export type WarriorUiSlice = Partial<ProfessionUiContract<Partial<WarriorPlanningState>>>;
