import type {
  RotationActionSummary,
  RotationPlayerIdentity,
  RotationReconstructionBase
} from '#gw2/integrations/logs/shared/rotation/model.js';

/** Models only metadata consumed by rotation reconstruction; raw report extras remain unmodeled. */
export interface DpsReportSkillMetadata {
  readonly name: string;
  readonly isSwap?: boolean;
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

export interface DpsReportWeaponSet {
  readonly weapons?: readonly string[];
}

export interface DpsReportMinion {
  readonly name: string;
  readonly id?: number;
  readonly rotation?: readonly DpsReportRotationGroup[];
}

/** Consumed player fields only; parsing preserves additional report data without modeling it here. */
export interface DpsReportPlayer {
  readonly name: string;
  readonly account?: string;
  readonly profession: string;
  readonly group?: number;
  readonly buffUptimes?: readonly DpsReportBuffTimeline[];
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
}

export interface ParsedDpsReport {
  readonly eliteInsightsVersion?: string;
  readonly triggerID?: number;
  readonly mapID?: number;
  readonly name?: string;
  readonly fightName?: string;
  readonly arcVersion?: string;
  readonly duration?: string;
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
