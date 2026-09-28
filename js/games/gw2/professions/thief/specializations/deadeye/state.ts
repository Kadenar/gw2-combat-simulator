import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  DEADEYE_RESOURCE_PROFILE,
  MALEFICENT_SEVEN_PROFILE
} from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { balanceProfileNumber } from '#gw2/platform/engine/skills/balance-profiles.js';
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
  maliceResolvedActivations: Record<string, boolean>;
  maleficentSevenTriggered: boolean;
}

function createDeadeyeState(config: ThiefConfig = {}): DeadeyeState {
  const traits = selectedThiefTraits(config);
  return {
    markedTargetId: null,
    markExpiresAt: 0,
    // Bumped each time Deadeye's Mark is applied; the expiry task checks this to ignore stale scheduled expirations
    markGeneration: 0,
    malice: 0,
    // State-only previews use authored defaults; initialization applies the selected patch.
    maximumMalice: balanceProfileNumber(
      hasTrait(traits, TRAIT.MALEFICENT_SEVEN) ? MALEFICENT_SEVEN_PROFILE : DEADEYE_RESOURCE_PROFILE,
      'maximumStacks'
    ),
    // Tracks which activationIds have already had their malice effect applied to prevent multi-hit double-counting
    maliceResolvedActivations: {},
    // Prevents Maleficent Seven from firing more than once per mark application at full malice
    maleficentSevenTriggered: false,
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
  maximumMalice: balanceProfileNumber(DEADEYE_RESOURCE_PROFILE, 'maximumStacks'),
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

export const deadeyeCastFacts = new WeakMap<RuntimeCast, DeadeyeCastFacts>();
