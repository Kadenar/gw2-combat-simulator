import { EvtcError } from "./errors.js";
import { EVTC_STATE_CHANGE } from "./types.js";
import type {
  EncounterValidationResult,
  ParsedEvtc,
  SupportedGolem,
} from "./types.js";

export const SPECIAL_FORCES_TRAINING_AREA_MAP_ID = 1154;

/**
 * Stable NPC species IDs accepted by Elite Insights' benchmark Golem logic.
 * Names are presentation only; validation is exclusively numeric.
 */
export const SUPPORTED_TRAINING_GOLEMS: readonly SupportedGolem[] =
  Object.freeze([
    {
      speciesId: 16169,
      name: "Massive Kitty Golem (10M)",
      expectedMapId: 1154,
    },
    { speciesId: 16202, name: "Massive Kitty Golem (4M)", expectedMapId: 1154 },
    { speciesId: 16178, name: "Massive Kitty Golem (1M)", expectedMapId: 1154 },
    { speciesId: 16198, name: "Vital Kitty Golem", expectedMapId: 1154 },
    { speciesId: 16177, name: "Average Kitty Golem", expectedMapId: 1154 },
    { speciesId: 16199, name: "Standard Kitty Golem", expectedMapId: 1154 },
    { speciesId: 19676, name: "Large Kitty Golem", expectedMapId: 1154 },
    { speciesId: 19645, name: "Medium Kitty Golem", expectedMapId: 1154 },
    { speciesId: 16174, name: "Tough Kitty Golem", expectedMapId: 1154 },
    { speciesId: 16176, name: "Resistant Kitty Golem", expectedMapId: 1154 },
  ]);

const bySpeciesId = new Map(
  SUPPORTED_TRAINING_GOLEMS.map((golem) => [golem.speciesId, golem]),
);

function npcSpecies(agent: ParsedEvtc["agents"][number]): number | null {
  if (agent.elite !== 0xffffffff || agent.profession >>> 16 === 0xffff) {
    return null;
  }
  return agent.profession & 0xffff;
}

function playerAgent(agent: ParsedEvtc["agents"][number]): boolean {
  return (
    agent.elite !== 0xffffffff &&
    (agent.account.startsWith(":") ||
      (agent.profession >= 1 && agent.profession <= 9))
  );
}

export function validateGolemEncounter(
  log: ParsedEvtc,
): EncounterValidationResult {
  const golem = bySpeciesId.get(log.header.encounterId);
  if (!golem) {
    throw new EvtcError(
      "UNSUPPORTED_ENCOUNTER",
      "This analyzer currently supports Special Forces Training Area golem logs only.",
      { encounterId: log.header.encounterId },
    );
  }
  const target = log.agents.find(
    (agent) => npcSpecies(agent) === golem.speciesId,
  );
  if (!target) {
    throw new EvtcError(
      "UNSUPPORTED_ENCOUNTER",
      "The EVTC trigger is a supported golem ID, but its target agent is missing.",
    );
  }
  const players = log.agents.filter(playerAgent);
  if (!players.length) {
    throw new EvtcError(
      "NO_PLAYER",
      "The EVTC log does not contain a real player.",
    );
  }
  const playerAddresses = new Set(players.map((player) => player.address));
  const playerInstances = new Set<number>();
  for (const event of log.events) {
    if (playerAddresses.has(event.source) && event.sourceInstance) {
      playerInstances.add(event.sourceInstance);
    }
  }
  const hasPlayerDamage = log.events.some(
    (event) =>
      event.target === target.address &&
      (playerAddresses.has(event.source) ||
        (event.sourceMasterInstance > 0 &&
          playerInstances.has(event.sourceMasterInstance))) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === 0 &&
      (event.value > 0 || event.buffDamage > 0),
  );
  if (!hasPlayerDamage) {
    throw new EvtcError(
      "NO_PLAYER_DAMAGE",
      "The log contains no player-originated combat against the recognized golem.",
    );
  }
  const mapEvent = log.events.find(
    (event) => event.stateChange === EVTC_STATE_CHANGE.MAP_ID,
  );
  const mapId = mapEvent ? Number(mapEvent.source) : null;
  if (mapId !== null && mapId !== golem.expectedMapId) {
    throw new EvtcError(
      "UNSUPPORTED_ENCOUNTER",
      "The recognized target was not recorded in the Special Forces Training Area.",
      { mapId },
    );
  }
  return { supported: true, golem, targetAddress: target.address, mapId };
}
