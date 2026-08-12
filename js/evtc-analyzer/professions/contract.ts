import type { EvtcAnalysisContext } from "../context.js";
import type { ProfessionAnalysisResult } from "../types.js";

export interface EvtcProfessionAnalyzer {
  readonly id: string;
  readonly professionId: string;
  readonly supportedSpecializations?: readonly string[];
  analyze(context: EvtcAnalysisContext): ProfessionAnalysisResult;
}
