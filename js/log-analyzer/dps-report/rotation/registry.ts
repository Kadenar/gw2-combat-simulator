import type { RotationCatalog } from '../../lib/rotation/catalog.js';
import { ROTATION_PROFILES, type RotationProfessionProfile } from '../../lib/rotation/profiles.js';
import { DpsReportError } from '../errors.js';
import type { DpsReportRotationReconstruction, ParsedDpsReport } from '../types.js';
import { detectDpsReportRotationPlayers, reconstructDpsReportWithProfile } from './reconstruct.js';
import type { DpsReportRotationOptions } from './types.js';
import { selectRotationPlayer } from '../../lib/rotation/selection.js';

export interface DpsReportProfessionRotationParser {
  readonly id: string;
  readonly professionId: string;
  readonly specializationId: string;
  readonly profile: RotationProfessionProfile;
  reconstruct(
    report: ParsedDpsReport,
    catalog?: RotationCatalog | null,
    options?: DpsReportRotationOptions
  ): DpsReportRotationReconstruction;
}

function parserForProfile(profile: RotationProfessionProfile): DpsReportProfessionRotationParser {
  return Object.freeze({
    id: `${profile.professionId}:${profile.specializationId}`,
    professionId: profile.professionId,
    specializationId: profile.specializationId,
    profile,
    reconstruct(
      report: ParsedDpsReport,
      catalog: RotationCatalog | null = null,
      options: DpsReportRotationOptions = {}
    ): DpsReportRotationReconstruction {
      return reconstructDpsReportWithProfile(report, profile, catalog, options);
    }
  });
}

export const DPS_REPORT_PROFESSION_ROTATION_PARSERS: readonly DpsReportProfessionRotationParser[] = Object.freeze(
  ROTATION_PROFILES.map(parserForProfile)
);

const parsersById = new Map(DPS_REPORT_PROFESSION_ROTATION_PARSERS.map((parser) => [parser.id, parser]));

export function getDpsReportProfessionRotationParser(
  professionId: string,
  specializationId: string
): DpsReportProfessionRotationParser | null {
  return parsersById.get(`${professionId}:${specializationId}`) || null;
}

/** Selects a report player and dispatches reconstruction through the profession registry. */
export function reconstructDpsReportRotation(
  report: ParsedDpsReport,
  catalog: RotationCatalog | null = null,
  options: DpsReportRotationOptions = {}
): DpsReportRotationReconstruction {
  const players = detectDpsReportRotationPlayers(report);
  const selection = selectRotationPlayer(
    players,
    options.playerIndex == null ? undefined : (candidate) => candidate.index === options.playerIndex
  );

  if (selection.status !== 'selected') {
    if (selection.status === 'no-player') {
      throw new DpsReportError('NO_PLAYER', 'The Elite Insights report contains no supported player.');
    }

    throw new DpsReportError(
      selection.status === 'selection-required' ? 'PLAYER_SELECTION_REQUIRED' : 'PLAYER_NOT_FOUND',
      selection.status === 'selection-required'
        ? 'Multiple players have the same recorded action count; select one by index.'
        : 'The requested player is not present in the Elite Insights report.'
    );
  }

  const player = selection.player;

  const parser = getDpsReportProfessionRotationParser(player.professionId, player.specializationId);
  if (!parser) {
    throw new DpsReportError(
      'UNSUPPORTED_PROFESSION',
      `No dps.report rotation parser is registered for ${player.professionName} ${player.specializationName}.`
    );
  }

  return parser.reconstruct(report, catalog, { ...options, playerIndex: player.index });
}
