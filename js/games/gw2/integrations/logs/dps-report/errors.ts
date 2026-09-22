import { LogAnalyzerError } from '#gw2/integrations/logs/shared/errors.js';

export class DpsReportError extends LogAnalyzerError {
  constructor(code: string, message: string) {
    super('DpsReportError', code, message);
  }
}
