import { createResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';

import type { ThiefStealthAttackChargeState, ThiefSkill } from '#gw2/professions/thief/types.js';

export interface DeadeyeState extends ThiefStealthAttackChargeState {
  markedTargetId: string | null;
  markExpiresAt: number;
  markGeneration: number;
  malice: ResourceClock;
  maliceResolvedActivations: Record<string, boolean>;
  maleficentSevenTriggered: boolean;
}

/** Starts an empty pool; the selected runtime policy supplies its trait and patch capacity. */
function createDeadeyeState(): DeadeyeState {
  return {
    markedTargetId: null,
    markExpiresAt: 0,
    // Bumped each time Deadeye's Mark is applied; the expiry task checks this to ignore stale scheduled expirations
    markGeneration: 0,
    malice: createResourceClock(),
    // Tracks which activationIds have already had their malice effect applied to prevent multi-hit double-counting
    maliceResolvedActivations: {},
    // Prevents Maleficent Seven from firing more than once per mark application at full malice
    maleficentSevenTriggered: false,
    // Silent Scope charge path: these mirror AntiquaryState fields so beginStealthAttack can consume them generically
    stealthAttackCharges: 0,
    stealthAttackExpiresAt: 0
  };
}

// Detached defaults describe fields exposed only when the Deadeye module is active.
export const DEADEYE_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  markedTargetId: null,
  markExpiresAt: 0,
  markGeneration: 0,
  malice: createResourceClock(),
  stealthAttackCharges: 0,
  stealthAttackExpiresAt: 0,
  maleficentSevenTriggered: false
} satisfies Partial<DeadeyeState>);

export const deadeyeState = defineProfessionSpecializationState('Deadeye', createDeadeyeState);

/** Accepted raw and marked malice remain available until the skill's commitment actions finish. */
interface DeadeyeCastFacts {
  readonly malice: number;
  readonly markedMalice: number;
}

export const deadeyeCastFacts = new WeakMap<RuntimeCast<ThiefSkill>, DeadeyeCastFacts>();
