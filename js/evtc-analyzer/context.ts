import { addressHex } from "./player-detection.js";
import { EVTC_STATE_CHANGE } from "./types.js";
import type {
  DetectedPlayer,
  EncounterValidationResult,
  ParsedEvtc,
  ParsedEvtcAgent,
  ParsedEvtcEvent,
} from "./types.js";

export class EvtcAnalysisContext {
  readonly log: ParsedEvtc;
  readonly encounter: EncounterValidationResult;
  readonly player: DetectedPlayer;
  readonly playerAgent: ParsedEvtcAgent;
  readonly targetAddress: bigint;
  readonly skillNames: ReadonlyMap<number, string>;
  readonly agentsByAddress: ReadonlyMap<bigint, ParsedEvtcAgent>;

  constructor(
    log: ParsedEvtc,
    encounter: EncounterValidationResult,
    player: DetectedPlayer,
  ) {
    this.log = log;
    this.encounter = encounter;
    this.player = player;
    const address = BigInt(player.address);
    const playerAgent = log.agents.find((agent) => agent.address === address);
    if (!playerAgent) throw new TypeError("Selected EVTC player is missing.");
    this.playerAgent = playerAgent;
    this.targetAddress = encounter.targetAddress;
    this.skillNames = new Map(
      log.skills.map((skill) => [skill.id, skill.name]),
    );
    this.agentsByAddress = new Map(
      log.agents.map((agent) => [agent.address, agent]),
    );
  }

  skillName(id: number): string {
    return this.skillNames.get(id) || `Unknown ${id}`;
  }

  isSelectedPlayerSource(event: ParsedEvtcEvent): boolean {
    return event.source === this.playerAgent.address;
  }

  isPlayerOwnedSource(event: ParsedEvtcEvent): boolean {
    return (
      this.isSelectedPlayerSource(event) ||
      (this.player.instanceId !== null &&
        event.sourceMasterInstance === this.player.instanceId)
    );
  }

  isDamageToTarget(event: ParsedEvtcEvent): boolean {
    return (
      event.target === this.targetAddress &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === 0 &&
      event.iff === 1 &&
      (event.value > 0 || event.buffDamage > 0)
    );
  }

  sourceLabel(event: ParsedEvtcEvent): string {
    const agent = this.agentsByAddress.get(event.source);
    return agent?.character || addressHex(event.source);
  }
}
