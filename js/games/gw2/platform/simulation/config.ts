import type { Gw2SelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2AttributeProvenance, ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import type { Gw2CriticalDamageMode } from '#gw2/platform/combat/critical-damage-mode.js';
import type { Gw2TargetConfig } from '#gw2/platform/combat/state/targets.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import type { Gw2SigilSet } from '#gw2/platform/equipment/sigils/types.js';
import type { TransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { SimulationRandomnessConfig } from '#kernel/core/simulation-random.js';
/** The validated run configuration: build stats, equipment, target and boon assumptions, and selected content. */

export interface Gw2Config {
  /** Active elite specialization, or "Core"; profession runtimes resolve their module set from it. */
  readonly specialization?: string;
  /** Starting value of the profession's primary resource. */
  readonly initialResource?: number;
  /** Patch the simulation runs against, when the application previews balance changes. */
  readonly patchId?: string;
  readonly procRateOverrides?: Readonly<Record<string, number>>;
  readonly transitionDelays?: Partial<TransitionDelays>;
  /** Base simulation attributes; weapon-set values override these for the active set. */
  readonly stats?: Gw2Stats;
  readonly weaponSetStats?: readonly Gw2Stats[];
  readonly boons?: Readonly<Record<string, boolean | number>>;
  /** Detached damage preview's total for per-boon bonuses; grants no boons and is never saved to a build. */
  readonly fixedBoonCount?: number;
  readonly sharePlayerBoonsWithSummons?: boolean;
  readonly startingWeaponSet?: number;
  readonly primaryWeapon?: string;
  readonly secondaryWeapon?: string;
  readonly weaponSet2Primary?: string;
  readonly weaponSet2Secondary?: string;
  readonly sigilSets?: readonly Gw2SigilSet[];
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly selectedSkillIds?: Gw2SelectedSkillLoadout;
  readonly relic?: string;
  readonly precastRelics?: readonly string[];
  readonly initialThornsStacks?: number;
  readonly food?: string;
  readonly utility?: string;
  readonly timeOfDay?: 'day' | 'night';
  readonly randomness?: SimulationRandomnessConfig;
  /** Deterministic strike damage policy; stochastic trials always use rolled critical damage. */
  readonly criticalDamageMode?: Gw2CriticalDamageMode;
  /** Selected value of each profession select-control assumption, keyed by control key. */
  readonly deterministicChoices?: Readonly<Record<string, unknown>>;
  /** Allied players sharing the encounter, for boon sharing and allied proc rules. */
  readonly allies?: {
    readonly count?: number;
    readonly strikesPerSecond?: number;
  };
  /** Character hitbox size; melee reach and some area rules read it. */
  readonly hitboxSize?: string;
  readonly professionAssumptions?: Readonly<ProfessionBuildAssumptions>;
  readonly attributeProvenance?: Partial<Gw2AttributeProvenance>;
  readonly target?: Gw2TargetConfig;
  readonly modifiers?: {
    readonly strike?: number;
    readonly condition?: number;
  };
  /**
   * Player buffs already active at time zero, applied as ordinary buff packets with fixed durations. Isolated previews
   * use this to hold a conditional buff for a measured cast; saved builds and the simulation config never set it.
   */
  readonly initialBuffs?: readonly Gw2InitialBuff[];
}

/** One preview-held player buff; kind and stacks follow the buff's own runtime representation. */
export interface Gw2InitialBuff {
  readonly kind: string;
  readonly stacks: number;
  /** Seconds the buff stays active from time zero. */
  readonly duration: number;
  readonly name?: string;
}
