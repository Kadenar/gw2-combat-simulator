export const EVTC_STATE_CHANGE = Object.freeze({
  NONE: 0,
  ENTER_COMBAT: 1,
  EXIT_COMBAT: 2,
  CHANGE_DEAD: 4,
  WEAPON_SWAP: 11,
  MAP_ID: 25,
  ANIMATION_START: 67,
  ANIMATION_STOP: 68,
  BUFF_APPLY: 69,
} as const);

export interface ParsedEvtcHeader {
  readonly magic: "EVTC";
  readonly arcdpsBuild: string;
  readonly revision: 0 | 1;
  readonly encounterId: number;
  readonly agentCount: number;
  readonly skillCount: number;
  readonly eventCount: number;
}

export interface ParsedEvtcAgent {
  readonly address: bigint;
  readonly profession: number;
  readonly elite: number;
  readonly toughness: number;
  readonly concentration: number;
  readonly healing: number;
  readonly condition: number;
  readonly character: string;
  readonly account: string;
  readonly subgroup: string;
}

export interface ParsedEvtcSkill {
  readonly id: number;
  readonly name: string;
}

export interface ParsedEvtcEvent {
  readonly time: number;
  readonly source: bigint;
  readonly target: bigint;
  readonly value: number;
  readonly buffDamage: number;
  readonly overstackValue: number;
  readonly skillId: number;
  readonly sourceInstance: number;
  readonly targetInstance: number;
  readonly sourceMasterInstance: number;
  readonly targetMasterInstance: number;
  readonly iff: number;
  readonly buff: number;
  readonly result: number;
  readonly activation: number;
  readonly buffRemove: number;
  readonly ninety: number;
  readonly fifty: number;
  readonly moving: number;
  readonly stateChange: number;
  readonly flanking: number;
  readonly shields: number;
  readonly offcycle: number;
  readonly pad: number;
}

export interface ParsedEvtc {
  readonly header: ParsedEvtcHeader;
  readonly agents: readonly ParsedEvtcAgent[];
  readonly skills: readonly ParsedEvtcSkill[];
  readonly events: readonly ParsedEvtcEvent[];
}

export interface SupportedGolem {
  readonly speciesId: number;
  readonly name: string;
  readonly expectedMapId: number;
}

export interface EncounterValidationResult {
  readonly supported: true;
  readonly golem: SupportedGolem;
  readonly targetAddress: bigint;
  readonly mapId: number | null;
}

export interface DetectedPlayer {
  readonly address: string;
  readonly instanceId: number | null;
  readonly character: string;
  readonly professionId: string;
  readonly professionName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly outgoingDamage: number;
}

export interface PlayerSelectionResult {
  readonly kind: "selected" | "selection-required";
  readonly players: readonly DetectedPlayer[];
  readonly selected: DetectedPlayer | null;
}

export interface DamageRollDistribution {
  readonly count: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly average: number;
  readonly samples: readonly number[];
  readonly normalizedToMean: readonly number[];
}

export interface SkillDamageSummary {
  readonly skillId: number;
  readonly skillName: string;
  readonly connectedHits: number;
  readonly criticalHits: number;
  readonly nonCriticalHits: number;
  readonly strikeDamage: number;
  readonly conditionDamage: number;
  readonly criticalDamageRolls: DamageRollDistribution | null;
  readonly nonCriticalDamageRolls: DamageRollDistribution | null;
}

export interface CastSummary {
  readonly skillId: number;
  readonly skillName: string;
  readonly count: number;
  readonly timestampsMs: readonly number[];
}

export interface WeaponSwapSummary {
  readonly timestampMs: number;
  readonly weaponSet: number | null;
}

export interface ActionsPerMinuteSummary {
  readonly castCount: number;
  readonly weaponSwapCount: number;
  readonly totalActions: number;
  readonly durationMs: number;
  readonly castApm: number;
  readonly apm: number;
}

export interface BuffApplicationSummary {
  readonly skillId: number;
  readonly skillName: string;
  readonly kind: "condition" | "buff" | "unknown";
  readonly source: string;
  readonly target: string;
  readonly applications: number;
  readonly totalDurationMs: number;
  readonly timestampsMs: readonly number[];
}

export interface GenericEvtcStatistics {
  readonly startTime: number;
  readonly endTime: number;
  readonly combatDurationMs: number;
  readonly totalOutgoingStrikeDamage: number;
  readonly totalOutgoingConditionDamage: number;
  readonly connectedStrikeHits: number;
  readonly criticalHits: number;
  readonly nonCriticalHits: number;
  readonly criticalHitRate: number | null;
  readonly perSkill: readonly SkillDamageSummary[];
  readonly casts: readonly CastSummary[];
  readonly actionsPerMinute: ActionsPerMinuteSummary;
  readonly weaponSwaps: readonly WeaponSwapSummary[];
  readonly weaponSets: {
    readonly status: "unavailable";
    readonly reason: string;
  };
  readonly outgoingApplications: readonly BuffApplicationSummary[];
  readonly weaponStrength: {
    readonly status: "unavailable";
    readonly missingInputs: readonly string[];
    readonly note: string;
  };
}

export type AttributionStatus = "exact" | "inferred" | "ambiguous";

export interface ProfessionAnalysisSection {
  readonly id: string;
  readonly title: string;
  readonly status: AttributionStatus;
  readonly fields: readonly {
    readonly label: string;
    readonly value: string | number;
  }[];
  readonly evidence: readonly string[];
  readonly assumptions: readonly string[];
}

export interface ProfessionAnalysisResult {
  readonly analyzerId: string;
  readonly sections: readonly ProfessionAnalysisSection[];
  readonly warnings: readonly string[];
}

export interface EvtcAnalysisResult {
  readonly header: ParsedEvtcHeader;
  readonly encounter: {
    readonly speciesId: number;
    readonly name: string;
    readonly mapId: number | null;
  };
  readonly player: DetectedPlayer;
  readonly generic: GenericEvtcStatistics;
  readonly profession: readonly ProfessionAnalysisResult[];
  readonly warnings: readonly string[];
}
