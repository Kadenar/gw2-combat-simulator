import { EvtcError } from "./errors.js";
import {
  professionMetadata,
  specializationMetadata,
} from "./profession-metadata.js";
import { EVTC_STATE_CHANGE } from "./types.js";
import type {
  DetectedPlayer,
  EncounterValidationResult,
  ParsedEvtc,
  ParsedEvtcAgent,
  PlayerSelectionResult,
} from "./types.js";

function isPlayer(agent: ParsedEvtcAgent): boolean {
  return (
    agent.elite !== 0xffffffff &&
    (agent.account.startsWith(":") ||
      (agent.profession >= 1 && agent.profession <= 9))
  );
}

export function addressHex(address: bigint): string {
  return `0x${address.toString(16)}`;
}

function instanceId(log: ParsedEvtc, address: bigint): number | null {
  for (const event of log.events) {
    if (event.source === address && event.sourceInstance > 0) {
      return event.sourceInstance;
    }
    if (event.target === address && event.targetInstance > 0) {
      return event.targetInstance;
    }
  }
  return null;
}

function playerDamage(
  log: ParsedEvtc,
  player: ParsedEvtcAgent,
  targetAddress: bigint,
): number {
  const playerInstance = instanceId(log, player.address);
  let total = 0;
  for (const event of log.events) {
    if (
      event.target !== targetAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.activation !== 0 ||
      (event.source !== player.address &&
        !(playerInstance && event.sourceMasterInstance === playerInstance))
    ) {
      continue;
    }
    total += Math.max(0, event.buff === 0 ? event.value : event.buffDamage);
  }
  return total;
}

function detected(
  log: ParsedEvtc,
  player: ParsedEvtcAgent,
  targetAddress: bigint,
): DetectedPlayer {
  const profession = professionMetadata(player.profession);
  const specialization = specializationMetadata(player.elite, profession.id);
  return {
    address: addressHex(player.address),
    instanceId: instanceId(log, player.address),
    character: player.character || "Unnamed player",
    professionId: profession.id,
    professionName: profession.name,
    specializationId: specialization.id,
    specializationName: specialization.name,
    outgoingDamage: playerDamage(log, player, targetAddress),
  };
}

export function detectPlayers(
  log: ParsedEvtc,
  encounter: EncounterValidationResult,
): PlayerSelectionResult {
  const all = log.agents
    .filter(isPlayer)
    .map((player) => detected(log, player, encounter.targetAddress))
    .sort((left, right) => right.outgoingDamage - left.outgoingDamage);
  if (!all.length) {
    throw new EvtcError(
      "NO_PLAYER",
      "The EVTC log does not contain a real player.",
    );
  }
  const maximum = all[0]?.outgoingDamage || 0;
  const meaningfulThreshold = Math.max(1, maximum * 0.01);
  const meaningful = all.filter(
    (player) => player.outgoingDamage >= meaningfulThreshold,
  );
  if (!meaningful.length) {
    throw new EvtcError(
      "NO_PLAYER_DAMAGE",
      "No player dealt meaningful damage to the recognized golem.",
    );
  }
  return meaningful.length === 1
    ? { kind: "selected", players: meaningful, selected: meaningful[0] }
    : { kind: "selection-required", players: meaningful, selected: null };
}

export function resolvePlayer(
  selection: PlayerSelectionResult,
  requestedAddress?: string,
): DetectedPlayer {
  if (!requestedAddress && selection.selected) return selection.selected;
  const player = selection.players.find(
    (candidate) => candidate.address === requestedAddress,
  );
  if (!player) {
    throw new EvtcError(
      "PLAYER_NOT_FOUND",
      "The selected player is not available.",
    );
  }
  return player;
}
