import type { EvtcRotationEvidence, ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import type { RotationActionStatus } from '#gw2/integrations/logs/lib/rotation/model.js';
import type { EvtcRotationCatalog } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import type { EvtcRotationProfessionProfile } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';

export interface EvtcRecordedRotationAction {
  readonly start: number;
  readonly end: number;
  readonly expectedDuration: number | null;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly evidence: EvtcRotationEvidence;
  readonly status: RotationActionStatus;
  readonly eventIndex: number;
  readonly weaponSet?: number | null;
  readonly suppressesWeaponSwap?: boolean;
  readonly initialState?: boolean;
  readonly precast?: boolean;
  readonly offTarget?: boolean;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
  readonly replayCastEnd?: number;
  readonly replayInterruptMs?: number;
  /** Remaining duration reported for a hidden initial-state replay action. */
  readonly initialStateDurationMs?: number;
  readonly forceCompleteReplay?: boolean;
  readonly independentTimeline?: boolean;
  readonly concurrentTimeline?: boolean;
  /** Keeps the observed action boundary for offsets without replaying its duration as a separate wait. */
  readonly suppressFollowingWait?: boolean;
  /** Earlier combat boundary inferred from profession-specific opening-hit evidence. */
  readonly combatStartOverride?: number;
  // Profession reconstruction can recover a missing EVTC combat boundary from an action's effect packets.
  readonly inferredCombatStart?: number;
}

export interface EvtcProfessionReconstructionContext {
  readonly log: ParsedEvtc;
  readonly playerAddress: bigint;
  readonly profile: EvtcRotationProfessionProfile;
  readonly catalog: EvtcRotationCatalog | null;
  readonly recordedActions: readonly EvtcRecordedRotationAction[];
  readonly selectedSkillNames?: readonly string[];
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
  readonly timelineOriginMs: number;
}

export type EvtcProfessionActionReconstructor = (
  context: EvtcProfessionReconstructionContext
) => readonly EvtcRecordedRotationAction[];
