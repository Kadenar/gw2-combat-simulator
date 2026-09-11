import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { RotationCatalog } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type { RotationActionStatus } from '#gw2/integrations/logs/lib/rotation/model.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/lib/rotation/profiles.js';

export interface RecordedLogAction {
  readonly start: number;
  readonly end: number;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly status: RotationActionStatus;
  readonly eventIndex: number;
  /** Keeps adapter source identity stable when normalization adjusts eventIndex for ordering. */
  readonly sourceActionIndex?: number;
  readonly isSwap: boolean;
  readonly metadataAccurate: boolean;
  /** Elite Insights' nominal cast length for this cast (observed duration plus any time gained). */
  readonly expectedDurationMs?: number;
  /** Replays a report-proven generated activation without occupying its modeled cast lane. */
  readonly replayInterruptMs?: number;
  readonly replayDurationMs?: number;
  /** Preserve an observed action inside another cast, such as an airborne Vindicator autoattack. */
  readonly concurrentTimeline?: boolean;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
  readonly independentTimeline?: boolean;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
}

export interface ResolvedLogAction extends RecordedLogAction {
  readonly skill: Skill | null;
  readonly name: string;
  readonly skillId: string | number;
}

export interface LogActionNormalizationContext {
  readonly profile: RotationProfessionProfile;
  readonly catalog: RotationCatalog | null;
  readonly recordedActions: readonly RecordedLogAction[];
  readonly selectedSkillNames?: readonly string[];
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}

export type LogActionNormalizer = (context: LogActionNormalizationContext) => readonly RecordedLogAction[];
