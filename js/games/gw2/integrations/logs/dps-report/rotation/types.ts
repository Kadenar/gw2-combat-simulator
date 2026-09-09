export interface DpsReportRotationOptions {
  readonly playerIndex?: number;
  readonly phaseIndex?: number;
  readonly selectedSkillNames?: readonly string[];
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}

export type {
  LogActionNormalizationContext as DpsReportProfessionReconstructionContext,
  RecordedLogAction as DpsReportRecordedAction,
  ResolvedLogAction as DpsReportResolvedAction,
  LogActionNormalizer as DpsReportProfessionActionReconstructor
} from '#gw2/integrations/logs/lib/rotation/normalization.js';
