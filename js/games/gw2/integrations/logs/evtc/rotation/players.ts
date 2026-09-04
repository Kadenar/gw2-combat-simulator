/** Selects EVTC players from source-specific evidence before reconstruction dispatch. */
import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { evtcProfessionMetadata, evtcSpecializationMetadata } from '#gw2/integrations/logs/evtc/profession-metadata.js';
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
  type EvtcRotationPlayer,
  type ParsedEvtc,
  type ParsedEvtcAgent,
  type ParsedEvtcEvent
} from '#gw2/integrations/logs/evtc/types.js';
import { EVTC_ROTATION_PROFILES, TRANSITION_WINDOW_MS } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { selectRotationPlayer } from '#gw2/integrations/logs/lib/rotation/selection.js';

const TRANSITION_GAIN_BUFF_IDS = new Set(
  EVTC_ROTATION_PROFILES.flatMap((profile) =>
    profile.buffTransitions.flatMap((transition) => (transition.gain ? [transition.buffSkillId] : []))
  )
);
const TRANSITION_LOSS_BUFF_IDS = new Set(
  EVTC_ROTATION_PROFILES.flatMap((profile) =>
    profile.buffTransitions.flatMap((transition) => (transition.loss ? [transition.buffSkillId] : []))
  )
);
const TRANSITION_LOSS_DURATION_BUFF_IDS = new Set(
  EVTC_ROTATION_PROFILES.flatMap((profile) =>
    profile.buffTransitions.flatMap((transition) =>
      transition.lossRequiresRemainingDuration ? [transition.buffSkillId] : []
    )
  )
);

function addressHex(address: bigint): string {
  return `0x${address.toString(16)}`;
}

function isPlayer(agent: ParsedEvtcAgent): boolean {
  return agent.elite !== 0xffffffff && agent.profession >= 1 && agent.profession <= 9;
}

export function selectedPlayerEvent(event: ParsedEvtcEvent, address: bigint): boolean {
  return event.source === address;
}

function rawActionCount(log: ParsedEvtc, address: bigint): number {
  let count = 0;
  let hasModernAnimations = false;
  const lastTransitionSignal = new Map<string, number>();
  for (const event of log.events) {
    if (event.target === address && event.buff !== 0) {
      const gain = event.buffRemove === 0;
      const configured = gain
        ? TRANSITION_GAIN_BUFF_IDS.has(event.skillId)
        : TRANSITION_LOSS_BUFF_IDS.has(event.skillId) &&
          (!TRANSITION_LOSS_DURATION_BUFF_IDS.has(event.skillId) || Math.max(event.value, event.buffDamage) > 0);
      const key = `${event.skillId}:${gain ? 'gain' : 'loss'}`;
      const previous = lastTransitionSignal.get(key);
      if (configured && (previous == null || event.time - previous >= TRANSITION_WINDOW_MS)) {
        count += 1;
        lastTransitionSignal.set(key, event.time);
      }
    }

    if (!selectedPlayerEvent(event, address)) continue;
    if (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START) {
      hasModernAnimations = true;
      count += 1;
    } else if (event.stateChange === EVTC_STATE_CHANGE.WEAPON_SWAP) {
      count += 1;
    }
  }

  if (hasModernAnimations) return count;
  const hasLegacyStarts = log.events.some(
    (event) =>
      selectedPlayerEvent(event, address) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS)
  );
  for (const event of log.events) {
    if (
      selectedPlayerEvent(event, address) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (hasLegacyStarts
        ? event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS
        : event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET)
    ) {
      count += 1;
    }
  }

  return count;
}

function playerDescription(log: ParsedEvtc, agent: ParsedEvtcAgent): EvtcRotationPlayer | null {
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
    specializationName: specialization.name,
    recordedActionCount: rawActionCount(log, agent.address)
  };
}

export function detectEvtcRotationPlayers(log: ParsedEvtc): readonly EvtcRotationPlayer[] {
  return log.agents
    .filter(isPlayer)
    .flatMap((agent) => {
      const player = playerDescription(log, agent);
      return player ? [player] : [];
    })
    .sort(
      (left, right) =>
        right.recordedActionCount - left.recordedActionCount || left.character.localeCompare(right.character)
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
  log: ParsedEvtc,
  requestedAddress?: bigint | string
): { readonly agent: ParsedEvtcAgent; readonly player: EvtcRotationPlayer } {
  const players = detectEvtcRotationPlayers(log);
  const parsed = requestedAddress == null ? null : parseRequestedAddress(requestedAddress);
  const selection = selectRotationPlayer(
    players,
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
      'Multiple players have the same recorded action count; select one by address.',
      { playerCount: players.length }
    );
  }

  const selected = selection.player;
  const address = BigInt(selected.address);
  const agent = log.agents.find((candidate) => candidate.address === address);
  if (!agent) {
    throw new EvtcError('PLAYER_NOT_FOUND', 'The selected player agent is missing from the EVTC log.');
  }

  return { agent, player: selected };
}
