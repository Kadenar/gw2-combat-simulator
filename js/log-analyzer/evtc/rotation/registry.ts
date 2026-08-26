import { EvtcError } from '../errors.js';
import type { EvtcRotationReconstruction, ParsedEvtc } from '../types.js';
import type { EvtcRotationCatalog } from './catalog.js';
import { detectEvtcRotationPlayers, reconstructWithProfile, type EvtcRotationOptions } from './reconstruct.js';
import { EVTC_ROTATION_PROFILES, evtcRotationProfile, type EvtcRotationProfessionProfile } from './profiles.js';
import { selectRotationPlayer } from '../../lib/rotation/selection.js';

export interface EvtcProfessionRotationParser {
  readonly id: string;
  readonly professionId: string;
  readonly specializationId: string;
  readonly profile: EvtcRotationProfessionProfile;
  reconstruct(
    log: ParsedEvtc,
    catalog?: EvtcRotationCatalog | null,
    options?: EvtcRotationOptions
  ): EvtcRotationReconstruction;
}

function parserForProfile(profile: EvtcRotationProfessionProfile): EvtcProfessionRotationParser {
  return Object.freeze({
    id: `${profile.professionId}:${profile.specializationId}`,
    professionId: profile.professionId,
    specializationId: profile.specializationId,
    profile,
    reconstruct(
      log: ParsedEvtc,
      catalog: EvtcRotationCatalog | null = null,
      options: EvtcRotationOptions = {}
    ): EvtcRotationReconstruction {
      return reconstructWithProfile(log, profile, catalog, options);
    }
  });
}

export const EVTC_PROFESSION_ROTATION_PARSERS: readonly EvtcProfessionRotationParser[] = Object.freeze(
  EVTC_ROTATION_PROFILES.map(parserForProfile)
);

const parsersById = new Map(EVTC_PROFESSION_ROTATION_PARSERS.map((parser) => [parser.id, parser]));

export function getEvtcProfessionRotationParser(
  professionId: string,
  specializationId: string
): EvtcProfessionRotationParser | null {
  if (!evtcRotationProfile(professionId, specializationId)) return null;
  return parsersById.get(`${professionId}:${specializationId}`) || null;
}

export function reconstructEvtcRotation(
  log: ParsedEvtc,
  catalog: EvtcRotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): EvtcRotationReconstruction {
  const players = detectEvtcRotationPlayers(log);
  let explicitMatch: ((candidate: (typeof players)[number]) => boolean) | undefined;
  if (options.playerAddress != null) {
    let address: bigint | null = null;
    try {
      address = typeof options.playerAddress === 'bigint' ? options.playerAddress : BigInt(options.playerAddress);
    } catch {
      address = null;
    }

    explicitMatch = (candidate) => address != null && BigInt(candidate.address) === address;
  }

  const selection = selectRotationPlayer(players, explicitMatch);

  if (selection.status !== 'selected') {
    if (selection.status === 'no-player') {
      throw new EvtcError('NO_PLAYER', 'The EVTC log contains no known player.');
    }

    throw new EvtcError(
      selection.status === 'selection-required' ? 'PLAYER_SELECTION_REQUIRED' : 'PLAYER_NOT_FOUND',
      selection.status === 'selection-required'
        ? 'Multiple players have the same recorded action count; select one by address.'
        : 'The requested player is not present in the EVTC log.'
    );
  }

  const player = selection.player;

  const parser = getEvtcProfessionRotationParser(player.professionId, player.specializationId);
  if (!parser) {
    throw new EvtcError(
      'UNSUPPORTED_PROFESSION',
      `No EVTC rotation parser is registered for ${player.professionName} ${player.specializationName}.`
    );
  }

  return parser.reconstruct(log, catalog, {
    ...options,
    playerAddress: player.address
  });
}
