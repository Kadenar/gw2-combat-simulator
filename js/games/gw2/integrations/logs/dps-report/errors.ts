import { LogAnalyzerError } from '#gw2/integrations/logs/lib/errors.js';

export class DpsReportError extends LogAnalyzerError {
  constructor(code: string, message: string, context: Readonly<Record<string, unknown>> = {}) {
    super('DpsReportError', code, message, context);
  }
}
