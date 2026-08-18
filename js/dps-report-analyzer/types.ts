import type {
  EvtcRotationActionKind,
  EvtcRotationActionStatus,
  EvtcReconstructedCommand
} from '../evtc-analyzer/types.js';

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

export interface DpsReportPlayer {
  readonly name: string;
  readonly account?: string;
  readonly profession: string;
  readonly group?: number;
  readonly firstAware?: number;
  readonly lastAware?: number;
  readonly activeTimes?: readonly number[];
  readonly rotation: readonly DpsReportRotationGroup[];
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
  readonly phases: readonly DpsReportPhase[];
  readonly skillMap: Readonly<Record<string, DpsReportSkillMetadata>>;
}

export interface DpsReportRotationPlayer {
  readonly index: number;
  readonly character: string;
  readonly account: string;
  readonly professionId: string;
  readonly professionName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly recordedActionCount: number;
}

export interface DpsReportRotationAction {
  readonly timestampMs: number;
  readonly endTimestampMs: number;
  readonly durationMs: number;
  readonly rawSkillId: number;
  readonly skillId: string | number;
  readonly name: string;
  readonly kind: EvtcRotationActionKind;
  readonly status: EvtcRotationActionStatus;
  readonly supportedByCatalog: boolean;
  readonly metadataAccurate: boolean;
  readonly inferred: boolean;
}

export interface DpsReportRotationReconstruction {
  readonly parserId: string;
  readonly player: DpsReportRotationPlayer;
  readonly phase: {
    readonly index: number;
    readonly name: string;
    readonly start: number;
    readonly end: number;
  };
  readonly timelineOriginMs: number;
  readonly combatStartTimestampMs: number;
  readonly actions: readonly DpsReportRotationAction[];
  readonly rotation: readonly EvtcReconstructedCommand[];
  readonly warnings: readonly string[];
}
