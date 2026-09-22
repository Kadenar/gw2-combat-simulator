export interface DpsReportRotationOptions {
  readonly playerIndex?: number;
  readonly phaseIndex?: number;
  readonly selectedSkillIds?: readonly number[];
  readonly professionConfig?: Readonly<Record<string, unknown>>;
}
