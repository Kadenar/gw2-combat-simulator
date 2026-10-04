/** Serializable skill damage preview contracts shared by the application, its worker, and the evaluator. */
import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';
import type { SkillDamageCastOptions } from '#gw2/platform/profession-presentation/skill-damage.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Per-probe configuration on top of the shared preview configuration. */
export interface SkillDamageProbeConfig {
  /** Proc-only discovery can satisfy owner-declared ambient conditions without changing skill measurements. */
  readonly targetConditions?: NonNullable<Gw2Config['target']>['conditions'];
  /** Dedicated proc measurements can make eligible opportunities certain without changing skill rows. */
  readonly procRateOverrides?: Gw2Config['procRateOverrides'];
  readonly startingWeaponSet?: number;
  readonly initialResource?: number;
  /** Replaces the slot selection so an unslotted heal, utility, or elite can be cast. */
  readonly selectedSkills?: readonly string[];
  /** Profession runtime fields the owning presentation supplied for this probe. */
  readonly profession?: Readonly<Record<string, unknown>>;
}

/** One measurable cast: setup runs off-target, then only the final cast's consequences are counted. */
export interface SkillDamageProbe {
  readonly id: string;
  readonly skillId: SkillId;
  /** Display name, used to say which casts a proc was observed on. */
  readonly name?: string;
  readonly setup: readonly RotationCommand[];
  /** Exercises a trigger sequence for proc rows only; none of its cast damage becomes a skill row. */
  readonly procOnly?: boolean;
  /** Specialized discovery conditions may contribute only to the owners whose requirements they prepare. */
  readonly procOwnerIds?: readonly string[];
  readonly cast?: Partial<SkillDamageCastOptions>;
  readonly config?: SkillDamageProbeConfig;
  readonly variants?: readonly {
    readonly id: string;
    readonly label: string;
    readonly cast?: Partial<SkillDamageCastOptions>;
  }[];
  readonly primaryVariantId?: string;
  /** Initial observation tail; queued effects and measured condition payouts determine any extension. */
  readonly tailMs: number;
}

/** Engine inputs only; the application adds the content address when it sends this to a worker. */
/** A build element whose damage packets form a proc row: a selected trait, the relic, a sigil, the rune, or food. */
export interface SkillDamageProcOwner {
  /** Describe an unobserved damage proc instead of silently treating missing trigger coverage as zero damage. */
  readonly triggerRequirement?: string;
  /** Stable owner identity within its source, such as a trait id or relic key. */
  readonly key: string;
  readonly source: 'Trait' | 'Relic' | 'Sigil' | 'Rune' | 'Food';
  readonly icon: string;
  /** Display name; omitted when the game's name is only known from the packet, as for relics. */
  readonly name?: string;
  /** Packet sources, source ids, or names that identify this owner, such as a trait name or `relic.<id>`. */
  readonly matches: readonly string[];
}

export interface SkillDamageRequest {
  readonly config: Gw2Config;
  readonly probes: readonly SkillDamageProbe[];
  readonly procOwners?: readonly SkillDamageProcOwner[];
}

/** Strike facts aggregated from the measured cast's damage diagnostics. */
export interface SkillDamageStrikeBreakdown {
  readonly weaponStrength: number | null;
  readonly power: number;
  /** Totals across counted hits, before modifiers, without crits, at crit, and the averaged result. */
  readonly baseDamage: number;
  readonly nonCriticalDamage: number;
  readonly criticalDamage: number;
  readonly averageDamage: number;
  readonly criticalChance: number;
  readonly criticalDamageMultiplier: number;
  readonly averagedCriticalMultiplier: number;
  readonly outgoingMultiplier: number;
  readonly contributors: readonly Gw2ModifierContribution[];
  /** True when hits used different outgoing multipliers; the breakdown then shows the first hit's factors. */
  readonly variesAcrossHits: boolean;
}

/** One damaging condition the measured cast applied, aggregated across its applications. */
export interface SkillDamageConditionRow {
  readonly condition: string;
  readonly stacks: number;
  readonly baseDurationSeconds: number;
  readonly effectiveDurationSeconds: number;
  readonly durationMultiplier: number;
  readonly baseDurationMultiplier: number;
  readonly durationContributors: readonly Gw2ModifierContribution[];
  readonly conditionDamage: number | null;
  /** Damage per stack-second before outgoing condition modifiers, from the first damaging sample. */
  readonly rate: number | null;
  readonly multiplier: number | null;
  readonly damageContributors: readonly Gw2ModifierContribution[];
  readonly damage: number;
}

/** The damage of one measured cast. */
export interface SkillDamageMeasurement {
  readonly castSeconds: number;
  readonly hits: number;
  readonly coefficient: number;
  readonly strike: number;
  readonly conditionDamage: number;
  readonly total: number;
  readonly strikeBreakdown: SkillDamageStrikeBreakdown | null;
  readonly conditions: readonly SkillDamageConditionRow[];
}

export interface SkillDamageVariantMeasurement {
  readonly id: string;
  readonly label: string;
  readonly measurement: SkillDamageMeasurement | null;
}

export interface SkillDamageProbeResult {
  readonly id: string;
  readonly measurement: SkillDamageMeasurement | null;
  readonly variants: readonly SkillDamageVariantMeasurement[];
  /** The variant whose measurement is the row's; absent when the probe has no variants. */
  readonly primaryVariantId?: string;
  /** Why the runtime refused the probe; a refused probe yields no row. */
  readonly rejected?: string;
}

/** A trait, relic, sigil, rune, or food proc observed while measuring, averaged per trigger. */
export interface SkillDamageProcResult {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly icon: string;
  readonly triggers: number;
  readonly perTrigger: SkillDamageMeasurement;
  readonly observedOn: readonly string[];
}

export interface SkillDamageEvaluation {
  readonly probes: readonly SkillDamageProbeResult[];
  readonly procs: readonly SkillDamageProcResult[];
}
