/** Declarative Mesmer skill records shared by generated data and runtime consumers. */
import type {
  ConditionEffect,
  ConditionTick,
  SchedulerRecord,
  SimulationActorType,
  Skill,
  SkillEffect,
  SkillFragment,
  SkillId,
  StrikeEffect,
  StrikeTick
} from '#gw2/platform/engine/types.js';

export type MesmerSummonKind = 'clone' | 'phantasm';

export interface MesmerSkillResource {
  readonly mode?: string;
  readonly count?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  readonly atMs?: number;
  readonly [field: string]: unknown;
}

export interface MesmerMechanic extends SchedulerRecord {
  readonly flipParentId?: number;
  readonly flipChildId?: number;
}

export interface MesmerStrikeEffect extends StrikeEffect {
  readonly castProgress?: number;
  readonly requiredTrait?: number;
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

export interface MesmerConditionApplication extends SchedulerRecord {
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

export interface MesmerEventExtra extends SchedulerRecord {
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
  readonly id: number;
  readonly ambush?: boolean;
  readonly duration?: number;
  readonly phantasm?: boolean;
  readonly blade?: boolean;
  readonly pulseCount?: number;
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
