export class DpsReportError extends Error {
  readonly code: string;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, context: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'DpsReportError';
    this.code = code;
    this.context = context;
  }
}
