import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { selectedThiefTraits } from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig, ThiefStealthAttackChargeState } from '#gw2/professions/thief/types.js';

export interface DeadeyeState extends ThiefStealthAttackChargeState {
  markedTargetId: string | null;
  markExpiresAt: number;
  markGeneration: number;
  malice: number;
  maximumMalice: number;
  maliceCriticalProgress: number;
  maliceResolvedActivations: Record<string, boolean>;
  maleficentSevenTriggered: boolean;
  deadeyeRelicUntil: number;
}

export function createDeadeyeState(config: ThiefConfig = {}): DeadeyeState {
  const traits = selectedThiefTraits(config);
  return {
    markedTargetId: null,
    markExpiresAt: 0,
    // Bumped each time Deadeye's Mark is applied; the expiry task checks this to ignore stale scheduled expirations
    markGeneration: 0,
    malice: 0,
    // Maleficent Seven raises the cap from 5 to 7 and must be known at construction time
    maximumMalice: hasTrait(traits, TRAIT.MALEFICENT_SEVEN) ? 7 : 5,
    // Fractional crit-chance accumulator; whole stacks are drained into malice when they cross 1
    maliceCriticalProgress: 0,
    // Tracks which activationIds have already had their malice effect applied to prevent multi-hit double-counting
    maliceResolvedActivations: {},
    // Prevents Maleficent Seven from firing more than once per mark application at full malice
    maleficentSevenTriggered: false,
    deadeyeRelicUntil: 0,
    // Silent Scope charge path: these mirror AntiquaryState fields so beginStealthAttack can consume them generically
    stealthAttackCharges: 0,
    stealthAttackExpiresAt: 0
  };
}

// Inactive public fallbacks declare only the Deadeye fields exposed by the family projection.
export const DEADEYE_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  markedTargetId: null,
  markExpiresAt: 0,
  markGeneration: 0,
  malice: 0,
  maximumMalice: 5,
  maliceCriticalProgress: 0,
  deadeyeRelicUntil: 0,
  stealthAttackCharges: 0,
  stealthAttackExpiresAt: 0,
  maleficentSevenTriggered: false
} satisfies Partial<DeadeyeState>);

export const deadeyeState = defineProfessionSpecializationState('Deadeye', createDeadeyeState);
