import type {
  RotationActionSummary,
  RotationPlayerIdentity,
  RotationReconstructionBase
} from '#gw2/integrations/logs/lib/rotation/model.js';

export interface DpsReportSkillMetadata {
  readonly name: string;
  readonly autoAttack?: boolean;
  readonly isSwap?: boolean;
  readonly isInstantCast?: boolean;
  readonly isTraitProc?: boolean;
  readonly isUnconditionalProc?: boolean;
  readonly isGearProc?: boolean;
  readonly isNotAccurate?: boolean;
}

export interface DpsReportCast {
  readonly castTime: number;
  readonly duration: number;
  readonly timeGained?: number;
  readonly quickness?: number;
}

export interface DpsReportRotationGroup {
  readonly id: number;
  readonly skills: readonly DpsReportCast[];
}

export interface DpsReportBuffTimeline {
  readonly id: number;
  readonly states?: readonly (readonly [number, number])[];
}

export interface DpsReportDamageDistribution {
  readonly id: number;
  readonly hits?: number;
  readonly connectedHits?: number;
}

export interface DpsReportWeaponSet {
  readonly weapons?: readonly string[];
  readonly timeframe?: readonly number[];
}

export interface DpsReportMinion {
  readonly name: string;
  readonly id?: number;
  readonly targetDamageDist?: readonly (readonly (readonly DpsReportDamageDistribution[])[])[];
}

export interface DpsReportPlayer {
  readonly name: string;
  readonly account?: string;
  readonly profession: string;
  readonly group?: number;
  readonly firstAware?: number;
  readonly lastAware?: number;
  readonly activeTimes?: readonly number[];
  readonly buffUptimes?: readonly DpsReportBuffTimeline[];
  readonly targetDamageDist?: readonly (readonly (readonly DpsReportDamageDistribution[])[])[];
  readonly weaponSets?: readonly DpsReportWeaponSet[];
  readonly minions?: readonly DpsReportMinion[];
  readonly rotation: readonly DpsReportRotationGroup[];
}

export interface DpsReportTarget {
  readonly buffs?: readonly DpsReportBuffTimeline[];
}

export interface DpsReportPhase {
  readonly start: number;
  readonly end: number;
  readonly name: string;
  readonly phaseType?: string;
  readonly encounterPhase?: number;
}

export interface ParsedDpsReport {
  readonly eliteInsightsVersion?: string;
  readonly triggerID?: number;
  readonly mapID?: number;
  readonly name?: string;
  readonly fightName?: string;
  readonly arcVersion?: string;
  readonly gW2Build?: number;
  readonly duration?: string;
  readonly durationMS?: number;
  readonly success?: boolean;
  readonly players: readonly DpsReportPlayer[];
  readonly targets?: readonly DpsReportTarget[];
  readonly phases: readonly DpsReportPhase[];
  readonly skillMap: Readonly<Record<string, DpsReportSkillMetadata>>;
}

export interface DpsReportRotationPlayer extends RotationPlayerIdentity {
  readonly index: number;
}

export interface DpsReportRotationAction extends RotationActionSummary {
  readonly metadataAccurate: boolean;
  readonly inferred: boolean;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
}

export interface DpsReportRotationReconstruction extends RotationReconstructionBase<
  DpsReportRotationPlayer,
  DpsReportRotationAction
> {
  readonly phase: {
    readonly index: number;
    readonly name: string;
    readonly start: number;
    readonly end: number;
  };
}
