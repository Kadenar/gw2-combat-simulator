/** Owns the simulation/config.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { SimulationRandomnessConfig } from '#kernel/core/simulation-random.js';
import type { TransitionDelays } from '#gw2/platform/skills/transition-delays.js';
import type { Gw2AttributeProvenance, ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import type { Gw2SelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2TargetConfig } from '#gw2/platform/combat/state/targets.js';
import type { Gw2SigilSet } from '#gw2/platform/equipment/sigils/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';

export interface Gw2Config {
  /** Active elite specialization, or "Core"; profession runtimes resolve their module set from it. */
  readonly specialization?: string;
  /** Starting value of the profession's primary resource. */
  readonly initialResource?: number;
  /** Player health as a fraction of maximum, for health-gated rules. */
  readonly playerHealthFraction?: number;
  /** Target health as a fraction of maximum when a caller configures it directly. */
  readonly targetHealthFraction?: number;
  /** Patch the simulation runs against, when the application previews balance changes. */
  readonly patchId?: string;
  readonly procRateOverrides?: Readonly<Record<string, number>>;
  readonly transitionDelays?: Partial<TransitionDelays>;
  readonly stats?: Gw2Stats;
  readonly weaponSetStats?: readonly Gw2Stats[];
  readonly attributes?: Gw2Stats;
  readonly boons?: Readonly<Record<string, boolean | number>>;
  readonly sharePlayerBoonsWithSummons?: boolean;
  readonly startingWeaponSet?: number;
  readonly primaryWeapon?: string;
  readonly secondaryWeapon?: string;
  readonly weaponSet2Primary?: string;
  readonly weaponSet2Secondary?: string;
  readonly sigilSets?: readonly Gw2SigilSet[];
  readonly selectedTraitIds?: readonly (string | number)[];
  readonly selectedSkills?: Gw2SelectedSkillLoadout;
  readonly relic?: string;
  readonly precastRelics?: readonly string[];
  readonly initialThornsStacks?: number;
  readonly food?: string;
  readonly utility?: string;
  readonly timeOfDay?: 'day' | 'night';
  readonly randomness?: SimulationRandomnessConfig;
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
  readonly alacrityRechargeRate?: number;
  readonly target?: Gw2TargetConfig;
  readonly modifiers?: {
    readonly strike?: number;
    readonly condition?: number;
  };
}
