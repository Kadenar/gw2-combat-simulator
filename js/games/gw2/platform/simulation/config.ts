import type { Gw2SelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import type { ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import type { Gw2AttributeInputs } from '#gw2/platform/attributes/types.js';
import type { Gw2CriticalDamageMode } from '#gw2/platform/combat/critical-damage-mode.js';
import type { Gw2TargetConfig } from '#gw2/platform/combat/state/targets.js';
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
  /** Session-only experimental patch values; never part of a persisted build. */
  readonly previewValues?: Readonly<Record<string, number>>;
  readonly procRateOverrides?: Readonly<Record<string, number>>;
  readonly transitionDelays?: Partial<TransitionDelays>;
  /** Both weapon sets contain common sources before any profession or temporary contribution. */
  readonly attributeInputs?: Gw2AttributeInputs;
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
  /** Logical bar positions for accepted-input observation; contains no personal key bindings. */
  readonly skillInputBars?: readonly import('#gw2/platform/skills/input-controls.js').InputSkillBar[];
  readonly relic?: string;
  readonly precastRelics?: readonly string[];
  readonly initialThornsStacks?: number;
  readonly food?: string;
  readonly utility?: string;
  readonly timeOfDay?: 'day' | 'night';
  readonly randomness?: SimulationRandomnessConfig;
  /** Deterministic strike damage policy; stochastic trials always use rolled critical damage. */
  readonly criticalDamageMode?: Gw2CriticalDamageMode;
  /** Allied players sharing the encounter, for boon sharing and allied proc rules. */
  readonly allies?: {
    readonly count?: number;
    readonly strikesPerSecond?: number;
  };
  readonly professionAssumptions?: Readonly<ProfessionBuildAssumptions>;
  readonly target?: Gw2TargetConfig;
  /** Boss-owned health gates and squad assumptions, separate from the player build. */
  readonly encounter?: import('#gw2/platform/combat/state/encounter.js').EncounterConfig;
  readonly modifiers?: {
    /** Player-owned damage factors exclude summon actors, even when their conditions inherit player stats. */
    readonly playerStrike?: number;
    readonly playerCondition?: number;
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
