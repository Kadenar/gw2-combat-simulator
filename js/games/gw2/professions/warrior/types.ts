import type { Gw2Build, Gw2BuildSpecialization, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { MechanicCombatContext, MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ProfessionUiCallbackContext, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { Gw2SharedProfessionPlanningState } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { WARRIOR_CORE_SKILL_FIELDS } from '#gw2/professions/warrior/core/catalog-fields.js';
import type { WarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import type { BERSERKER_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/berserker/catalog-fields.js';
import type { BerserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { BLADESWORN_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/bladesworn/catalog-fields.js';
import type { BladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { PARAGON_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/paragon/catalog-fields.js';
import type { ParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { SpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';

interface WarriorBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkillIds?: Record<string, SkillId | null>;
}

export interface WarriorCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

/** Public consumers receive only the ID/value pairs published by active owners. */
export type WarriorPlanningState = Gw2SharedProfessionPlanningState &
  ReturnType<typeof import('#gw2/professions/warrior/core/state.js').projectWarriorCorePlanningState> &
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
  /** Measured Dual Wielding cast-start offsets replace the skill's authored offsets before shared scheduling. */
  readonly dualWieldEffectOffsetsMs?: Readonly<Record<number, number>>;
  /** Spends adrenaline as a burst skill. */
  readonly burst?: boolean;
  /** Primal burst available only while berserk. */
  readonly primalBurst?: boolean;
  /** Available only while the gunsaber is drawn. */
  readonly gunsaberSkill?: boolean;
  /** Dragon Trigger charge skill. */
  readonly dragonTriggerSkill?: boolean;
  readonly movementSkill?: boolean;
  readonly dragonSlash?: boolean;
  /** Base action replaced by this Sharp as the Wind variant. */
  readonly sharpAsTheWindParentId?: SkillId;
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
export type WarriorUiSlice = Partial<ProfessionUiContract<Partial<WarriorPlanningState>, WarriorSkill>>;
