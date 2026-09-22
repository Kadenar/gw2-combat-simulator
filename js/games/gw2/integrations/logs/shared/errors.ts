/** Carries a stable machine-readable failure code across log adapters. */
export class LogAnalyzerError<Code extends string = string> extends Error {
  readonly code: Code;

  constructor(name: string, code: Code, message: string) {
    super(message);
    this.name = name;
    this.code = code;
  }
}
