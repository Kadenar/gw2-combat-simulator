import { LogAnalyzerError } from '#gw2/integrations/logs/shared/errors.js';

export class WingmanError extends LogAnalyzerError {
  constructor(code: string, message: string) {
    super('WingmanError', code, message);
  }
}
