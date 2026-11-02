/** Declarative Mesmer skill records shared by owner declarations and runtime consumers. */
import type { SimulationActorType } from '#gw2/platform/constants.js';
import type { ConditionEffect, SkillEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { EffectMetadata } from '#gw2/platform/events/events.js';
import type { NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { MESMER_CORE_SKILL_FIELDS } from '#gw2/professions/mesmer/core/catalog-fields.js';
import type { TROUBADOUR_SKILL_FIELDS } from '#gw2/professions/mesmer/specializations/troubadour/catalog-fields.js';

// Troubadour afterimages are illusions, so every illusion rule applies to them alongside clones and phantasms.
export type MesmerSummonKind = 'clone' | 'phantasm' | 'afterimage';

interface MesmerSkillResource {
  readonly mode?: string;
  readonly count?: number;
  readonly clarityCount?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  readonly atMs?: number;
  readonly [field: string]: unknown;
}

export interface MesmerStrikeEffect extends StrikeEffect {
  readonly summonKind?: MesmerSummonKind;
}

export interface MesmerConditionEffect extends ConditionEffect {
  readonly condition: string;
  readonly duration: number;
  readonly packetLabel?: string;
  readonly summonKind?: MesmerSummonKind;
  readonly phantasmEntityIndex?: number;
}

/** Optional fields emitted by Mesmer controllers, beyond the shared event envelope. */
export interface MesmerEventExtra {
  /** Explicit cause connects scheduled trait grants to their proc announcement. */
  readonly parentEventOrder?: number;
  /** Captures the accepted cast that owns an immediate or delayed outcome. */
  readonly activationId?: string;
  readonly metadata?: EffectMetadata;
  readonly skillName?: string;
  readonly detail?: string;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly icon?: string;
  readonly count?: number;
  readonly multiplier?: number;
  readonly amount?: number;
  readonly maximum?: number;
  readonly value?: number;
  readonly resource?: string;
  readonly reason?: string;
  readonly created?: readonly { readonly id: number; readonly weapon: string }[];
  readonly conversionTimes?: readonly number[];
  readonly repeat?: boolean;
  readonly summonOwner?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly priority?: number;
  readonly audience?: import('#gw2/platform/events/events.js').EffectAudience;
  readonly weaponStrength?: number;
  readonly damageBreakdownName?: string;
  readonly controlKind?: string;
  readonly persistsAfterInterrupt?: boolean;
  readonly expiresAt?: number;

  readonly name?: string;
  readonly parentSkillName?: string;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly skillId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly summonKind?: MesmerSummonKind;
}

type MesmerTrackedHitDamage = Partial<MesmerStrikeEffect> & {
  readonly duration: number;
  readonly hitsRequired: number;
  readonly name: string;
  readonly skillId?: SkillId;
};

export interface MesmerSkill
  extends
    Skill,
    NumericSkillFields<typeof MESMER_CORE_SKILL_FIELDS>,
    NumericSkillFields<typeof TROUBADOUR_SKILL_FIELDS> {
  readonly id: number;
  readonly ambush?: boolean;
  /** Performance reward and the instruments it requires. */
  readonly tale?: {
    readonly name: string;
  } &
    // Performance rewards require either a named instrument or a minimum number of distinct instruments.
    (
      | { readonly instrument: string; readonly minimumInstruments?: never }
      | { readonly instrument?: never; readonly minimumInstruments: number }
    );
  /** Payload a mirror replays for this skill. */
  readonly mirrorPayloadSkillId?: number;
  readonly duration?: number;
  /** Summons a phantasm whose attacks follow its timing recipe. */
  readonly phantasm?: boolean;
  /** Overrides the summoned phantasm's attack timing. */
  readonly phantasmTiming?: Partial<
    import('#gw2/professions/mesmer/core/mechanics/illusions/types.js').MesmerPhantasmAttackTiming
  >;
  /** Counts as a blade-producing skill for blade-dependent mechanics. */
  readonly blade?: boolean;
  /** Shatter recipe consuming the live illusions. */
  readonly shatter?: import('#gw2/professions/mesmer/core/mechanics/shatter-types.js').MesmerShatterDefinition;
  /** Authored instrument identity supports capacity queries without reaching into live illusion controllers. */
  readonly instrument?: import('#gw2/professions/mesmer/types.js').MesmerInstrument;
  /** Arms its follow-up flip when the cast starts rather than when it commits. */
  readonly armedAtStart?: boolean;
  /** Intrinsic follow-up window this skill opens. */
  readonly flipArm?: {
    readonly skillId: number;
    readonly duration: number;
    readonly delay?: number;
    readonly anchor?: 'castStart' | 'castCommit';
  };
  /** Hits whose damage this skill records for a later payout. */
  readonly trackedHitDamage?: MesmerTrackedHitDamage;
  // Authored packets use shared effect forms, including conditions whose values live on individual ticks.
  readonly effects?: readonly (SkillEffect & {
    readonly phantasmEntityIndex?: number;
    readonly packetLabel?: string;
  })[];
  readonly resource?: MesmerSkillResource | null;
}
