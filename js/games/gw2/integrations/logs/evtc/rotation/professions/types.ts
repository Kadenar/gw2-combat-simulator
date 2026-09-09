import type { EvtcRotationEvidence, ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import type { RotationActionStatus } from '#gw2/integrations/logs/lib/rotation/model.js';
import type { RotationCatalog } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type { EvtcRotationProfessionProfile } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';

export interface EvtcRecordedRotationAction {
  readonly start: number;
  readonly end: number;
  readonly expectedDuration: number | null;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly evidence: EvtcRotationEvidence;
  readonly status: RotationActionStatus;
  readonly acceleration?: number;
  readonly savedDurationMs?: number;
  readonly metadataAccurate?: boolean;
  readonly eiRule?: string;
  readonly castOrigin?: 'skill' | 'trait' | 'gear' | 'unconditional';
  readonly eventIndex: number;
  readonly weaponSet?: number | null;
  readonly precast?: boolean;
  readonly offTarget?: boolean;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
  readonly replayCastEnd?: number;
  readonly replayInterruptMs?: number;
  readonly replayDurationMs?: number;
  readonly independentTimeline?: boolean;
  readonly concurrentTimeline?: boolean;
  /** Direct damage proves this autoattack executed during Vindicator's leap before landing. */
  readonly vindicatorDodgeAuto?: boolean;
}

export interface EvtcProfessionReconstructionContext {
  readonly log: ParsedEvtc;
  readonly playerAddress: bigint;
  readonly profile: EvtcRotationProfessionProfile;
  readonly catalog: RotationCatalog | null;
  readonly recordedActions: readonly EvtcRecordedRotationAction[];
  readonly selectedSkillNames?: readonly string[];
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
  readonly timelineOriginMs: number;
}

export type EvtcProfessionActionReconstructor = (
  context: EvtcProfessionReconstructionContext
) => readonly EvtcRecordedRotationAction[];
