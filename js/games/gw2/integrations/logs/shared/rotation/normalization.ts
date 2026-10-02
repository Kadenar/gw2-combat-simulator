import type { ResolvedRotationIdentity, RotationCatalog } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type { RotationActionStatus } from '#gw2/integrations/logs/shared/rotation/model.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/shared/rotation/profiles.js';

/** Common represented input; adapters supply source evidence and normalization supplies required flags. */
export interface RecordedRotationAction {
  readonly start: number;
  readonly end: number;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly status: RotationActionStatus;
  readonly eventIndex: number;
  /** Index into the adapter's original actions; absent for inputs synthesized by normalization. */
  readonly sourceActionIndex?: number;
  readonly isSwap?: boolean;
  readonly metadataAccurate?: boolean;
  /** Nominal duration of the represented input, updated by composite/variant rules; absent when unknown. */
  readonly expectedDurationMs?: number;
  /** Explicit replay cutoff chosen from source evidence or profession normalization, including instant activations. */
  readonly replayInterruptMs?: number;
  readonly replayDurationMs?: number;
  /** Preserve an observed action inside another cast, such as an airborne Vindicator autoattack. */
  readonly concurrentTimeline?: boolean;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
  readonly releaseAtCharges?: number;
  readonly releaseDelayMs?: number;
  readonly independentTimeline?: boolean;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
}

/** Normalizers receive explicit flags, without promising to preserve an adapter's arbitrary evidence subtype. */
export interface RecordedLogAction extends RecordedRotationAction {
  readonly isSwap: boolean;
  readonly metadataAccurate: boolean;
}

export type ResolvedLogAction<Action extends RecordedRotationAction = RecordedLogAction> = Action &
  ResolvedRotationIdentity;

export interface LogActionNormalizationContext {
  readonly profile: RotationProfessionProfile;
  readonly catalog: RotationCatalog | null;
  readonly recordedActions: readonly RecordedLogAction[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}

export type LogActionNormalizer = (context: LogActionNormalizationContext) => readonly RecordedLogAction[];
