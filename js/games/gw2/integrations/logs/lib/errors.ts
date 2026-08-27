/** Carries a stable machine-readable failure code and adapter-specific diagnostic context. */
export class LogAnalyzerError<
  Code extends string = string,
  Context extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
> extends Error {
  readonly code: Code;
  readonly context: Context;

  constructor(name: string, code: Code, message: string, context: Context) {
    super(message);
    this.name = name;
    this.code = code;
    this.context = context;
  }
}
