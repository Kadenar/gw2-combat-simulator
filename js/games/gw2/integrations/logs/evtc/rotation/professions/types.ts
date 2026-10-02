import type { EvtcRotationEvidence, ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import type { RecordedRotationAction } from '#gw2/integrations/logs/shared/rotation/normalization.js';
import type { RotationCatalog } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type { RotationProfessionProfile } from '#gw2/integrations/logs/shared/rotation/profiles.js';

export interface EvtcRecordedRotationAction extends RecordedRotationAction {
  readonly evidence: EvtcRotationEvidence;
  readonly acceleration?: number;
  readonly savedDurationMs?: number;
  readonly eiRule?: string;
  readonly castOrigin?: 'skill' | 'trait' | 'gear' | 'unconditional';
  readonly weaponSet?: number | null;
  readonly replayCastEnd?: number;
  /** Direct damage proves this autoattack executed during Vindicator's leap before landing. */
  readonly vindicatorDodgeAuto?: boolean;
}

export interface EvtcProfessionReconstructionContext {
  readonly log: ParsedEvtc;
  readonly playerAddress: bigint;
  readonly profile: RotationProfessionProfile;
  readonly catalog: RotationCatalog | null;
  readonly recordedActions: readonly EvtcRecordedRotationAction[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}
