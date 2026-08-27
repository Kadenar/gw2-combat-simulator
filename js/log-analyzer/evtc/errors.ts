import { LogAnalyzerError } from '../lib/errors.js';

export type EvtcErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_MAGIC'
  | 'TRUNCATED_HEADER'
  | 'TRUNCATED_AGENTS'
  | 'TRUNCATED_SKILLS'
  | 'TRUNCATED_EVENTS'
  | 'LIMIT_EXCEEDED'
  | 'UNSUPPORTED_REVISION'
  | 'INVALID_ZIP'
  | 'UNSUPPORTED_COMPRESSION'
  | 'EXPANDED_SIZE_EXCEEDED'
  | 'ZIP_BOMB'
  | 'UNSUPPORTED_ENCOUNTER'
  | 'NO_PLAYER'
  | 'NO_PLAYER_DAMAGE'
  | 'UNUSABLE_INTERVAL'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_SELECTION_REQUIRED'
  | 'UNSUPPORTED_PROFESSION'
  | 'NO_ROTATION_ACTIONS'
  | 'WORKER_ERROR';

export class EvtcError extends LogAnalyzerError<EvtcErrorCode> {
  readonly details?: Readonly<Record<string, string | number | boolean>>;

  constructor(code: EvtcErrorCode, message: string, details?: Readonly<Record<string, string | number | boolean>>) {
    super('EvtcError', code, message, details || {});
    this.details = details;
  }
}
