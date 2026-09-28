import { usesModernAnimations } from '#gw2/integrations/logs/evtc/recording.js';
import { modernAnimationActions, legacyActivationActions } from '#gw2/integrations/logs/evtc/rotation/animations.js';
import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { evtcProfessionMetadata, evtcSpecializationMetadata } from '#gw2/integrations/logs/evtc/profession-metadata.js';
import {
  EVTC_STATE_CHANGE,
  type EvtcRotationPlayer,
  type ParsedEvtc,
  type ParsedEvtcAgent,
  type ParsedEvtcEvent
} from '#gw2/integrations/logs/evtc/types.js';

import { selectRotationPlayer } from '#gw2/integrations/logs/shared/rotation/selection.js';
import type { EvtcRecordedRotationAction } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export interface EvtcPlayerEvidence {
  readonly agent: ParsedEvtcAgent;
  readonly player: EvtcRotationPlayer;
  readonly castActions: readonly EvtcRecordedRotationAction[];
}

function addressHex(address: bigint): string {
  return `0x${address.toString(16)}`;
}

function isPlayer(agent: ParsedEvtcAgent): boolean {
  return agent.elite !== 0xffffffff && agent.profession >= 1 && agent.profession <= 9;
}

export function selectedPlayerEvent(event: ParsedEvtcEvent, address: bigint): boolean {
  return event.source === address;
}

function playerDescription(agent: ParsedEvtcAgent): Omit<EvtcRotationPlayer, 'recordedActionCount'> | null {
  const profession = evtcProfessionMetadata(agent.profession);
  if (!profession) return null;
  const specialization = evtcSpecializationMetadata(agent.elite, profession.id);
  if (!specialization) return null;
  return {
    address: addressHex(agent.address),
    character: agent.character || 'Unnamed player',
    account: agent.account,
    professionId: profession.id,
    professionName: profession.name,
    specializationId: specialization.id,
    specializationName: specialization.name
  };
}

/** Decode once so selection and reconstruction share the same cast evidence, including pre-log stops. */
export function detectEvtcRotationPlayers(log: ParsedEvtc): readonly EvtcPlayerEvidence[] {
  const names = new Map(log.skills.map((skill) => [skill.id, skill.name]));
  const decode = usesModernAnimations(log) ? modernAnimationActions : legacyActivationActions;
  const swaps = new Map<bigint, number>();
  for (const event of log.events) {
    if (event.stateChange === EVTC_STATE_CHANGE.WEAPON_SWAP) {
      swaps.set(event.source, (swaps.get(event.source) ?? 0) + 1);
    }
  }

  return log.agents
    .filter(isPlayer)
    .flatMap((agent) => {
      const player = playerDescription(agent);
      if (!player) return [];
      const castActions = decode(log, agent.address, names);
      return [
        {
          agent,
          castActions,
          player: {
            ...player,
            recordedActionCount: castActions.length + (swaps.get(agent.address) ?? 0)
          }
        }
      ];
    })
    .sort(
      (left, right) =>
        right.player.recordedActionCount - left.player.recordedActionCount ||
        left.player.character.localeCompare(right.player.character)
    );
}

function parseRequestedAddress(address: bigint | string): bigint | null {
  if (typeof address === 'bigint') return address;
  try {
    return BigInt(address);
  } catch {
    return null;
  }
}

/** Resolves an explicit address or the strongest evidence while retaining EVTC-specific errors. */
export function selectPlayerAgent(
  evidence: readonly EvtcPlayerEvidence[],
  requestedAddress?: bigint | string
): EvtcPlayerEvidence {
  const parsed = requestedAddress == null ? null : parseRequestedAddress(requestedAddress);
  const selection = selectRotationPlayer(
    evidence.map(({ player }) => player),
    requestedAddress == null ? undefined : (player) => parsed != null && BigInt(player.address) === parsed
  );
  if (selection.status !== 'selected') {
    if (selection.status === 'no-player') {
      throw new EvtcError('NO_PLAYER', 'The EVTC log contains no known player.');
    }

    if (selection.status === 'player-not-found') {
      throw new EvtcError('PLAYER_NOT_FOUND', 'The requested player is not present in the EVTC log.');
    }

    throw new EvtcError(
      'PLAYER_SELECTION_REQUIRED',
      'Multiple players have the same recorded action count; select one by address.'
    );
  }

  return evidence.find(({ player }) => player === selection.player)!;
}
