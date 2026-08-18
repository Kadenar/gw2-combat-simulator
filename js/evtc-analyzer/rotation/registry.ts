import { EvtcError } from '../errors.js';
import type { EvtcRotationReconstruction, ParsedEvtc } from '../types.js';
import type { EvtcRotationCatalog } from './catalog.js';
import { detectEvtcRotationPlayers, reconstructWithProfile, type EvtcRotationOptions } from './reconstruct.js';
import { EVTC_ROTATION_PROFILES, evtcRotationProfile, type EvtcRotationProfessionProfile } from './profiles.js';

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
  let player: (typeof players)[number] | undefined = players[0];
  if (options.playerAddress != null) {
    let address: bigint | null = null;
    try {
      address = typeof options.playerAddress === 'bigint' ? options.playerAddress : BigInt(options.playerAddress);
    } catch {
      address = null;
    }
    player = players.find((candidate) => address != null && BigInt(candidate.address) === address);
  } else if (players.length > 1 && players[0].recordedActionCount === players[1].recordedActionCount) {
    player = undefined;
  }
  if (!player) {
    if (!players.length) {
      throw new EvtcError('NO_PLAYER', 'The EVTC log contains no known player.');
    }
    throw new EvtcError(
      options.playerAddress == null ? 'PLAYER_SELECTION_REQUIRED' : 'PLAYER_NOT_FOUND',
      options.playerAddress == null
        ? 'Multiple players have the same recorded action count; select one by address.'
        : 'The requested player is not present in the EVTC log.'
    );
  }
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
