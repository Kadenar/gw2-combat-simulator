import { DpsReportError } from './errors.js';
import type {
  DpsReportCast,
  DpsReportPhase,
  DpsReportPlayer,
  DpsReportRotationGroup,
  DpsReportSkillMetadata,
  ParsedDpsReport
} from './types.js';

function record(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseCast(value: unknown, playerIndex: number, groupIndex: number, castIndex: number): DpsReportCast {
  if (!record(value) || !finite(value.castTime) || !finite(value.duration)) {
    throw new DpsReportError('INVALID_ROTATION_CAST', 'The Elite Insights report contains an invalid cast entry.', {
      playerIndex,
      groupIndex,
      castIndex
    });
  }

  return value as unknown as DpsReportCast;
}

function parseRotationGroup(value: unknown, playerIndex: number, groupIndex: number): DpsReportRotationGroup {
  if (!record(value) || !finite(value.id) || !Array.isArray(value.skills)) {
    throw new DpsReportError(
      'INVALID_ROTATION_GROUP',
      'The Elite Insights report contains an invalid skill rotation group.',
      { playerIndex, groupIndex }
    );
  }

  return {
    id: value.id,
    skills: value.skills.map((cast, castIndex) => parseCast(cast, playerIndex, groupIndex, castIndex))
  };
}

function parsePlayer(value: unknown, playerIndex: number): DpsReportPlayer {
  if (
    !record(value) ||
    typeof value.name !== 'string' ||
    typeof value.profession !== 'string' ||
    !Array.isArray(value.rotation)
  ) {
    throw new DpsReportError('INVALID_PLAYER', 'The Elite Insights report contains an invalid player entry.', {
      playerIndex
    });
  }

  return {
    ...(value as unknown as DpsReportPlayer),
    rotation: value.rotation.map((group, groupIndex) => parseRotationGroup(group, playerIndex, groupIndex))
  };
}

function parsePhase(value: unknown, phaseIndex: number): DpsReportPhase {
  if (!record(value) || !finite(value.start) || !finite(value.end) || typeof value.name !== 'string') {
    throw new DpsReportError('INVALID_PHASE', 'The Elite Insights report contains an invalid phase entry.', {
      phaseIndex
    });
  }

  return value as unknown as DpsReportPhase;
}

function parseSkillMap(value: unknown): Readonly<Record<string, DpsReportSkillMetadata>> {
  if (!record(value)) {
    throw new DpsReportError('INVALID_SKILL_MAP', 'The Elite Insights report has no skill metadata map.');
  }

  for (const [key, metadata] of Object.entries(value)) {
    if (!record(metadata) || typeof metadata.name !== 'string') {
      throw new DpsReportError('INVALID_SKILL_METADATA', 'The Elite Insights report contains invalid skill metadata.', {
        key
      });
    }
  }

  return value as Readonly<Record<string, DpsReportSkillMetadata>>;
}

/** Validates raw Elite Insights JSON before rotation reconstruction consumes its timeline. */
export function parseDpsReport(input: string | unknown): ParsedDpsReport {
  let value: unknown = input;

  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      throw new DpsReportError('INVALID_JSON', `Unable to parse Elite Insights JSON: ${String(error)}`);
    }
  }

  if (!record(value) || !Array.isArray(value.players) || !Array.isArray(value.phases)) {
    throw new DpsReportError('INVALID_REPORT', 'The JSON is not an Elite Insights report with players and phases.');
  }

  if (!value.players.length) {
    throw new DpsReportError('NO_PLAYER', 'The Elite Insights report contains no players.');
  }

  if (!value.phases.length) {
    throw new DpsReportError('NO_PHASE', 'The Elite Insights report contains no phases.');
  }

  return {
    ...(value as unknown as ParsedDpsReport),
    players: value.players.map(parsePlayer),
    phases: value.phases.map(parsePhase),
    skillMap: parseSkillMap(value.skillMap)
  };
}

/** Cheap shape check lets the app distinguish EI JSON from saved rotation JSON. */
export function isDpsReportData(value: unknown): boolean {
  return record(value) && Array.isArray(value.players) && Array.isArray(value.phases) && record(value.skillMap);
}
