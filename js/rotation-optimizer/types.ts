import type { LegacyRotationItem, SkillId } from "../platform/engine/types.js";
import type { Gw2Config, Gw2SimulationResult } from "../platform/gw2/types.js";

export interface RotationOptimizerCandidate {
  readonly skillId: SkillId;
  readonly name: string;
  readonly declaredDamage: boolean;
  readonly potentialEnabler: boolean;
  readonly priorityEnabler?: boolean;
  readonly weaponSets?: readonly number[];
}

export interface RotationOptimizerRequest {
  readonly professionId: string;
  readonly config: Gw2Config;
  readonly candidates: readonly RotationOptimizerCandidate[];
  /** Fixed setup ending with the Combat Start marker. */
  readonly setupRotation?: readonly LegacyRotationItem[];
  /** Current combat sequence, used as the exact initial incumbent. */
  readonly incumbentRotation?: readonly LegacyRotationItem[];
  readonly horizonMs: number;
  readonly evaluationBudget?: number;
  readonly wallClockLimitMs?: number;
  readonly seed?: number;
  readonly objective?: "fixed-window-dps";
  readonly beamWidth?: number;
  readonly branchLimit?: number;
  readonly enablerReserve?: number;
  readonly maxActions?: number;
  readonly timeBudgetMs?: number;
}

export interface RotationOptimizerProgress {
  readonly depth: number;
  /** Furthest point in the requested combat window reached by this frontier. */
  readonly simulatedTimeMs: number;
  readonly precastDurationMs: number;
  readonly evaluated: number;
  readonly evaluationBudget: number;
  readonly bestDps: number;
  readonly bestDamage: number;
  readonly projectedDps: number;
  readonly projectedDamage: number;
  readonly frontierSize: number;
}

export type RotationOptimizerStopReason =
  | "evaluation-budget"
  | "wall-clock-limit"
  | "frontier-exhausted"
  | "max-actions";

export interface RotationOptimizerDiagnostics {
  readonly baselineDps: number;
  readonly baselineDamage: number;
  readonly incumbentDps: number;
  readonly incumbentDamage: number;
  readonly exactEvaluations: number;
  readonly projectedEvaluations: number;
  readonly frontierPeak: number;
  readonly stopReason: RotationOptimizerStopReason;
  readonly removedZeroDamageActions: number;
}

export interface RotationOptimizerResult {
  readonly rotation: LegacyRotationItem[];
  readonly dps: number;
  readonly totalDamage: number;
  readonly baselineDps: number;
  readonly baselineDamage: number;
  readonly improvementDps: number;
  readonly improvementPercent: number;
  readonly horizonMs: number;
  readonly combatStartTimeMs: number;
  readonly precastActions: number;
  readonly activeDurationMs: number;
  readonly completedHorizon: boolean;
  readonly actions: number;
  readonly combatActions: number;
  readonly evaluated: number;
  readonly exactEvaluations: number;
  readonly projectedEvaluations: number;
  readonly removedActions: number;
  readonly timedOut: boolean;
  readonly improved: boolean;
  readonly diagnostics: RotationOptimizerDiagnostics;
}

export type RotationSimulation = (
  rotation: readonly LegacyRotationItem[],
  config: Gw2Config,
) => Gw2SimulationResult;

export interface RotationOptimizerWorkerRequest {
  readonly requestId: number;
  readonly request: RotationOptimizerRequest;
}

export interface RotationOptimizerWorkerResponse {
  readonly requestId: number;
  readonly progress?: RotationOptimizerProgress;
  readonly result?: RotationOptimizerResult;
  readonly error?: string;
}
