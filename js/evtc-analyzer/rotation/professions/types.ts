import type {
  EvtcRotationActionStatus,
  EvtcRotationEvidence,
  ParsedEvtc,
} from "../../types.js";
import type { EvtcRotationCatalog } from "../catalog.js";
import type { EvtcRotationProfessionProfile } from "../profiles.js";

export interface EvtcRecordedRotationAction {
  readonly start: number;
  readonly end: number;
  readonly expectedDuration: number | null;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly evidence: EvtcRotationEvidence;
  readonly status: EvtcRotationActionStatus;
  readonly eventIndex: number;
  readonly weaponSet?: number | null;
  readonly suppressesWeaponSwap?: boolean;
  readonly initialState?: boolean;
  readonly precast?: boolean;
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
  readonly doubleEdgeOutcome?: "success" | "backfire";
  readonly replayCastEnd?: number;
}

export interface EvtcProfessionReconstructionContext {
  readonly log: ParsedEvtc;
  readonly playerAddress: bigint;
  readonly profile: EvtcRotationProfessionProfile;
  readonly catalog: EvtcRotationCatalog | null;
  readonly recordedActions: readonly EvtcRecordedRotationAction[];
  readonly selectedSkillNames?: readonly string[];
}

export type EvtcProfessionActionReconstructor = (
  context: EvtcProfessionReconstructionContext,
) => readonly EvtcRecordedRotationAction[];
