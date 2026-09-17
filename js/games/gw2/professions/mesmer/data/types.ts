/** Declarative Mesmer skill records shared by generated data and runtime consumers. */
import type {
  ConditionEffect,
  ConditionTick,
  Skill,
  SkillEffect,
  SkillFragment,
  SkillId,
  StrikeEffect,
  StrikeTick
} from '#gw2/platform/engine/skills/types.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/events.js';

export type MesmerSummonKind = 'clone' | 'phantasm';

export interface MesmerSkillResource {
  readonly mode?: string;
  readonly count?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  readonly atMs?: number;
  readonly [field: string]: unknown;
}

export interface MesmerMechanic {
  readonly chaosStormPoison?: ConditionEffect;
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

export type MesmerDamageGroup = Partial<MesmerStrikeEffect> & {
  readonly type?: 'strike';
};

export interface MesmerConditionApplication {
  readonly name: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly applications?: number;
  readonly atMs?: number;
  readonly intervalMs?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  readonly timingScale?: 'cast' | 'fixed';
  readonly ticks?: readonly ConditionTick[];
  readonly summonKind?: MesmerSummonKind;
}

/** Optional fields emitted by Mesmer controllers, beyond the shared event envelope. */
export interface MesmerEventExtra {
  readonly cloneId?: number;
  readonly skillName?: string;
  readonly detail?: string;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly icon?: string;
  readonly blade?: boolean;
  readonly count?: number;
  readonly multiplier?: number;
  readonly amount?: number;
  readonly value?: number;
  readonly resource?: string;
  readonly reason?: string;
  readonly rotationIndex?: number | null;
  readonly created?: readonly { readonly id: number; readonly weapon: string }[];
  readonly conversionTimes?: readonly number[];
  readonly repeat?: boolean;
  readonly complete?: boolean;
  readonly summonOwner?: string;
  readonly cooldowns?: Readonly<Record<string, number>>;
  readonly targetSkillId?: SkillId;
  readonly targetSkillName?: string;
  readonly reduction?: number;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly priority?: number;
  readonly audience?: { readonly recipients: string; readonly maximumRecipients?: number };
  readonly weaponStrength?: number;
  readonly damageBreakdownName?: string;
  readonly controlKind?: string;
  readonly persistsAfterInterrupt?: boolean;
  readonly instrument?: string;
  readonly expiresAt?: number;

  readonly name?: string;
  readonly parentSkillName?: string;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly skillId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly summonKind?: MesmerSummonKind;
  readonly shatter?: boolean;
  readonly shatterTraitEligible?: boolean;
}

export type MesmerSkillEffect =
  MesmerStrikeEffect | MesmerConditionEffect | Exclude<SkillEffect, StrikeEffect | ConditionEffect>;

export type MesmerTrackedHitDamage = MesmerDamageGroup & {
  readonly duration: number;
  readonly hitsRequired: number;
  readonly name: string;
  readonly skillId?: SkillId;
  readonly ticks?: readonly StrikeTick[];
};

export interface MesmerSkill extends Skill {
  readonly shadowstepSkill?: boolean;
  /** Seconds from shadowstep activation to Peitha impact, including launch latency and travel. */
  readonly peithaProjectileDelay?: number;
  /** Additional spear effects require the Clarity consumed by this activation. */
  readonly clarityEffects?: readonly SkillEffect[];
  readonly id: number;
  readonly ambush?: boolean;
  readonly duration?: number;
  readonly phantasm?: boolean;
  readonly blade?: boolean;
  readonly boonlessCoefficient?: number;
  readonly applyConditionsOnInterrupt?: boolean;
  readonly armedAtStart?: boolean;
  readonly flipDelay?: number;
  readonly flipDuration?: number;
  readonly maxCloneEffects?: readonly MesmerConditionEffect[];
  readonly parentCooldownIncrease?: number;
  readonly phantasmSummonProgress?: number;
  readonly trackedHitDamage?: MesmerTrackedHitDamage;
  readonly effects?: readonly MesmerSkillEffect[];
  readonly resource?: MesmerSkillResource | null;
  readonly mesmerMechanic?: MesmerMechanic;
}

export type MesmerSkillCatalogFragment = SkillFragment & {
  readonly id: number;
};
