import type { SimulationActorType } from '#gw2/platform/constants.js';
/** Declarative Mesmer skill records shared by generated data and runtime consumers. */
import type { ConditionEffect, SkillEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { EffectMetadata } from '#gw2/platform/events/events.js';

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
  readonly castProgress?: number;
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
  readonly complete?: boolean;
  readonly summonOwner?: string;
  readonly cooldowns?: Readonly<Record<string, number>>;
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

export interface MesmerSkill extends Skill {
  readonly id: number;
  readonly ambush?: boolean;
  readonly crescendoProfileId?: string;
  readonly tale?: {
    readonly name: string;
    readonly profileId: string;
    readonly resourceGain: number;
    readonly effects: readonly SkillEffect[];
  } &
    // Performance rewards require either a named instrument or a minimum number of distinct instruments.
    (
      | { readonly instrument: string; readonly minimumInstruments?: never }
      | { readonly instrument?: never; readonly minimumInstruments: number }
    );
  readonly mirrorPayload?: { readonly profileId: string; readonly skillId: number; readonly name: string };
  readonly duration?: number;
  readonly phantasm?: boolean;
  readonly phantasmTiming?: Partial<
    import('#gw2/professions/mesmer/core/mechanics/illusions/types.js').MesmerPhantasmAttackTiming
  >;
  readonly blade?: boolean;
  readonly shatter?: import('#gw2/professions/mesmer/core/mechanics/shatter-types.js').MesmerShatterDefinition;
  /** Authored instrument identity supports capacity queries without reaching into live illusion controllers. */
  readonly instrument?: import('#gw2/professions/mesmer/types.js').MesmerInstrument;
  readonly armedAtStart?: boolean;
  readonly flipArm?: {
    readonly skillId: number;
    readonly duration: number;
    readonly delay?: number;
    readonly anchor?: 'castStart' | 'castCommit';
  };
  readonly parentCooldownIncrease?: number;
  readonly phantasmSummonProgress?: number;
  readonly trackedHitDamage?: MesmerTrackedHitDamage;
  // Authored packets use shared effect forms, including conditions whose values live on individual ticks.
  readonly effects?: readonly (SkillEffect & {
    readonly castProgress?: number;
    readonly phantasmEntityIndex?: number;
    readonly packetLabel?: string;
  })[];
  readonly resource?: MesmerSkillResource | null;
}
