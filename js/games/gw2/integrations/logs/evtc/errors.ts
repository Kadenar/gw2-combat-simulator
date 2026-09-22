import { LogAnalyzerError } from '#gw2/integrations/logs/shared/errors.js';

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
  | 'NO_PLAYER'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_SELECTION_REQUIRED'
  | 'UNSUPPORTED_PROFESSION'
  | 'NO_ROTATION_ACTIONS';

export class EvtcError extends LogAnalyzerError<EvtcErrorCode> {
  constructor(code: EvtcErrorCode, message: string) {
    super('EvtcError', code, message);
  }
}
