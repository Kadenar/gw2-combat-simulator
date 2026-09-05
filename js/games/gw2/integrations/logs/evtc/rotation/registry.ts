import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import type { EvtcRotationAction, EvtcRotationPlayer, ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import type { RotationReconstructionBase } from '#gw2/integrations/logs/lib/rotation/model.js';
import type { RotationCatalog } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { reconstructWithProfile, type EvtcRotationOptions } from '#gw2/integrations/logs/evtc/rotation/reconstruct.js';
import {
  EVTC_ROTATION_PROFILES,
  evtcRotationProfile,
  type EvtcRotationProfessionProfile
} from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { selectPlayerAgent } from '#gw2/integrations/logs/evtc/rotation/players.js';

export interface EvtcProfessionRotationParser {
  readonly id: string;
  readonly professionId: string;
  readonly specializationId: string;
  readonly profile: EvtcRotationProfessionProfile;
  reconstruct(
    log: ParsedEvtc,
    catalog?: RotationCatalog | null,
    options?: EvtcRotationOptions
  ): RotationReconstructionBase<EvtcRotationPlayer, EvtcRotationAction>;
}

function parserForProfile(profile: EvtcRotationProfessionProfile): EvtcProfessionRotationParser {
  return Object.freeze({
    id: `${profile.professionId}:${profile.specializationId}`,
    professionId: profile.professionId,
    specializationId: profile.specializationId,
    profile,
    reconstruct(
      log: ParsedEvtc,
      catalog: RotationCatalog | null = null,
      options: EvtcRotationOptions = {}
    ): RotationReconstructionBase<EvtcRotationPlayer, EvtcRotationAction> {
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
  catalog: RotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): RotationReconstructionBase<EvtcRotationPlayer, EvtcRotationAction> {
  // Dispatch and direct profile reconstruction use the same player-selection contract.
  const { player } = selectPlayerAgent(log, options.playerAddress);

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
