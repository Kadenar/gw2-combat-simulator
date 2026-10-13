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

interface WarriorBuild extends Gw2Build {
  specializations?: Gw2BuildSpecialization[];
  selectedSkillIds?: Record<string, SkillId | null>;
}

export interface WarriorCanonicalBuild extends Gw2CanonicalBuild {
  initialResource: number;
}

/** Composes family state from the state contracts owned by Core and each specialization. */
export interface WarriorState
  extends WarriorCoreState, BerserkerState, SpellbreakerState, BladeswornState, ParagonState {
  /** User-friendly refrain name derived from activeRefrainId for display. */
  activeRefrain: string;
}

export interface WarriorRuntimeState {
  core: WarriorCoreState;
  specialization:
    | { kind: 'Core'; state: Record<string, never> }
    | { kind: 'Berserker'; state: BerserkerState }
    | { kind: 'Spellbreaker'; state: SpellbreakerState }
    | { kind: 'Bladesworn'; state: BladeswornState }
    | { kind: 'Paragon'; state: ParagonState };
}

export interface WarriorSkill extends Skill {
  /**
   * Measured cast duration (ms) while Dual Wielding and Quickness are active.
   * Only skills with this value receive a Dual Wielding cast-time adjustment.
   */
  readonly dualWieldCastTimeMs?: number;
  /** Fixed commit cutoff while Dual Wielding is active; independent of cast-duration scaling. */
  readonly dualWieldInterruptCommitMs?: number;
  /** Measured cast-start packet offsets keyed by authored offset; replaces proportional scaling for this skill. */
  readonly dualWieldEffectOffsetsMs?: Readonly<Record<number, number>>;
  readonly adrenalineCost?: number;
  readonly burst?: boolean;
  readonly primalBurst?: boolean;
  readonly gunsaberSkill?: boolean;
  readonly dragonTriggerSkill?: boolean;
  readonly movementSkill?: boolean;
  readonly dragonSlash?: boolean;
  /** Fixed impact offset from release; slashes without an offset hit at cast end. */
  readonly dragonSlashImpactOffsetMs?: number;
  readonly dragonSlashMinimumCoefficient?: number;
  readonly dragonSlashMaximumCoefficient?: number;
  readonly dragonSlashMinimumBurningDuration?: number;
  readonly dragonSlashMaximumBurningDuration?: number;
}

/** Shared full mechanic context; read-only and resolver consumers retain their narrower capabilities. */
export type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

export type WarriorResolverContext = MechanicCombatContext & {
  profession: WarriorRuntimeState;
};

export interface WarriorUiContext extends Omit<ProfessionUiCallbackContext<Partial<WarriorState>>, 'build'> {
  readonly config?: Gw2Config;
  readonly build?: WarriorBuild | null;
}

/** UI slice whose callbacks read Warrior end-state projections. */
export type WarriorUiSlice = Partial<ProfessionUiContract<Partial<WarriorState>>>;
