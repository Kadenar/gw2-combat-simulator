import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { expireCharges, grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { flattenProfessionState, projectPublicProfessionState } from '#gw2/platform/profession-definition/state.js';
import { skillFlipVisible } from '#gw2/platform/execution/skill-flips.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';

export interface GuardianCoreState {
  endurance: ResourceClock;
  justiceActiveArmed: boolean;
  justiceHitCount: number;
  virtueReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  autoattackChains: Record<string, SkillId>;
  availableFlips: SkillFlipWindows;
  symbolicAvengerExpirations: number[];
  symbolIgnitionStartsAt: number;
  symbolIgnitionUntil: number;

  resolutionUntil: number;
  righteousInstinctsGeneration: number;
  righteousInstinctsCause: Gw2ResolverEvent | null;

  spearIlluminated: ChargeGrant;
  spearLuminanceUntil: number;
}

// Create a complete Guardian core state with bounded resources and initialized
// virtue, trait, symbol, and flip bookkeeping.
export function createGuardianCoreState(): GuardianCoreState {
  return {
    endurance: createResourceClock(100),
    justiceActiveArmed: false,
    justiceHitCount: 0,
    virtueReadyAt: {
      justice: 0,
      resolve: 0,
      courage: 0
    },
    autoattackChains: {},
    availableFlips: {},
    symbolicAvengerExpirations: [],
    symbolIgnitionStartsAt: -1,
    symbolIgnitionUntil: -1,

    resolutionUntil: 0,
    righteousInstinctsGeneration: 0,
    righteousInstinctsCause: null,

    spearIlluminated: grantCharges(0, 0),
    spearLuminanceUntil: 0
  };
}

/** Each Symbolic Avenger stack expires independently, including between symbol hits. */
export function activeSymbolicAvengerExpirations(state: Partial<GuardianCoreState>, at: number): number[] {
  return purgeExpiredStacks(state.symbolicAvengerExpirations || [], at);
}

/** Preserve literal public keys so projection types cannot expose private virtue readiness or hit counters. */
const GUARDIAN_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'endurance',

  'justiceActiveArmed',
  'autoattackChains',
  'availableFlips',
  'symbolIgnitionStartsAt',
  'symbolIgnitionUntil',

  'symbolicAvengerExpirations',

  'resolutionUntil',
  'spearIlluminated',
  'spearLuminanceUntil'
] as const satisfies readonly (keyof GuardianCoreState)[]);

// Core fields have no inactive fallbacks; their values come from the live state.
const GUARDIAN_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: GUARDIAN_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

/** Detach only public fields before expiring visible windows, leaving private state and live owners untouched. */
export function projectGuardianPlanningState(input: Gw2PlanningStateInput) {
  const state = projectPublicProfessionState(
    flattenProfessionState(input.profession) as unknown as GuardianCoreState,
    GUARDIAN_CORE_PUBLIC_STATE_PROJECTION.keys,
    GUARDIAN_CORE_PUBLIC_STATE_PROJECTION.defaults
  );
  // Projections can precede a flip's expiry task; never expose an expired flip to the palette.
  state.availableFlips = Object.fromEntries(
    Object.entries(state.availableFlips).filter(([, window]) => skillFlipVisible(window, input.time))
  );
  state.symbolicAvengerExpirations = activeSymbolicAvengerExpirations(state, input.time);
  // Project only live entitlement without consuming the runtime's captured grant.
  expireCharges(state.spearIlluminated, input.time);
  return state;
}
