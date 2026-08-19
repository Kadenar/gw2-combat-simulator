import type { EvtcRotationCatalog } from '../../evtc-analyzer/rotation/catalog.js';
import { EVTC_ROTATION_PROFILES, type EvtcRotationProfessionProfile } from '../../evtc-analyzer/rotation/profiles.js';
import { DpsReportError } from '../errors.js';
import type { DpsReportRotationReconstruction, ParsedDpsReport } from '../types.js';
import { detectDpsReportRotationPlayers, reconstructDpsReportWithProfile } from './reconstruct.js';
import type { DpsReportRotationOptions } from './types.js';

export interface DpsReportProfessionRotationParser {
  readonly id: string;
  readonly professionId: string;
  readonly specializationId: string;
  readonly profile: EvtcRotationProfessionProfile;
  reconstruct(
    report: ParsedDpsReport,
    catalog?: EvtcRotationCatalog | null,
    options?: DpsReportRotationOptions
  ): DpsReportRotationReconstruction;
}

function parserForProfile(profile: EvtcRotationProfessionProfile): DpsReportProfessionRotationParser {
  return Object.freeze({
    id: `${profile.professionId}:${profile.specializationId}`,
    professionId: profile.professionId,
    specializationId: profile.specializationId,
    profile,
    reconstruct(
      report: ParsedDpsReport,
      catalog: EvtcRotationCatalog | null = null,
      options: DpsReportRotationOptions = {}
    ): DpsReportRotationReconstruction {
      return reconstructDpsReportWithProfile(report, profile, catalog, options);
    }
  });
}

export const DPS_REPORT_PROFESSION_ROTATION_PARSERS: readonly DpsReportProfessionRotationParser[] = Object.freeze(
  EVTC_ROTATION_PROFILES.map(parserForProfile)
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
  catalog: EvtcRotationCatalog | null = null,
  options: DpsReportRotationOptions = {}
): DpsReportRotationReconstruction {
  const players = detectDpsReportRotationPlayers(report);
  let player =
    options.playerIndex == null ? players[0] : players.find((candidate) => candidate.index === options.playerIndex);
  if (
    options.playerIndex == null &&
    players.length > 1 &&
    players[0].recordedActionCount === players[1].recordedActionCount
  ) {
    player = undefined;
  }

  if (!player) {
    if (!players.length) {
      throw new DpsReportError('NO_PLAYER', 'The Elite Insights report contains no supported player.');
    }

    throw new DpsReportError(
      options.playerIndex == null ? 'PLAYER_SELECTION_REQUIRED' : 'PLAYER_NOT_FOUND',
      options.playerIndex == null
        ? 'Multiple players have the same recorded action count; select one by index.'
        : 'The requested player is not present in the Elite Insights report.'
    );
  }

  const parser = getDpsReportProfessionRotationParser(player.professionId, player.specializationId);
  if (!parser) {
    throw new DpsReportError(
      'UNSUPPORTED_PROFESSION',
      `No dps.report rotation parser is registered for ${player.professionName} ${player.specializationName}.`
    );
  }

  return parser.reconstruct(report, catalog, { ...options, playerIndex: player.index });
}
