import type { Skill } from '../../platform/engine/types.js';
import type { EvtcRotationActionStatus } from '../../evtc-analyzer/types.js';
import type { EvtcRotationCatalog } from '../../evtc-analyzer/rotation/catalog.js';
import type { EvtcRotationProfessionProfile } from '../../evtc-analyzer/rotation/profiles.js';
import type { ParsedDpsReport } from '../types.js';

export interface DpsReportRotationOptions {
  readonly playerIndex?: number;
  readonly phaseIndex?: number;
  readonly selectedSkillNames?: readonly string[];
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}

export interface DpsReportRecordedAction {
  readonly start: number;
  readonly end: number;
  readonly rawSkillId: number;
  readonly rawName: string;
  readonly status: EvtcRotationActionStatus;
  readonly eventIndex: number;
  readonly isSwap: boolean;
  readonly metadataAccurate: boolean;
  /** Elite Insights' nominal cast length for this cast (observed duration plus any time gained). */
  readonly expectedDurationMs?: number;
  readonly control?: 'cooldown-reset';
  readonly followingWaitMs?: number;
  readonly inference?:
    'initial-kit' | 'mine-setup' | 'luminary-opening' | 'renegade-warband' | 'herald-opening' | 'conduit-opening';
  readonly canonicalSkillId?: number;
  readonly canonicalName?: string;
}

export interface DpsReportResolvedAction extends DpsReportRecordedAction {
  readonly skill: Skill | null;
  readonly name: string;
  readonly skillId: string | number;
}

export interface DpsReportProfessionReconstructionContext {
  readonly report: ParsedDpsReport;
  readonly profile: EvtcRotationProfessionProfile;
  readonly catalog: EvtcRotationCatalog | null;
  readonly recordedActions: readonly DpsReportRecordedAction[];
  readonly selectedSkillNames?: readonly string[];
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}

export type DpsReportProfessionActionReconstructor = (
  context: DpsReportProfessionReconstructionContext
) => readonly DpsReportRecordedAction[];
