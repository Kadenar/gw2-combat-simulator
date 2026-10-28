import { expireCharges, grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { skillFlipVisible, type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { cloneStateFields } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

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
    endurance: createResourceClock(ENDURANCE.maximum),
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

/** Detach only public fields before expiring visible windows, leaving private state and live owners untouched. */
export function projectGuardianPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields((input.profession as { core: ReturnType<typeof createGuardianCoreState> }).core, [
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
  ]);
  // Projections can precede a flip's expiry task; never expose an expired flip to the palette.
  state.availableFlips = Object.fromEntries(
    Object.entries(state.availableFlips).filter(([, window]) => skillFlipVisible(window, input.time))
  );
  state.symbolicAvengerExpirations = activeSymbolicAvengerExpirations(state, input.time);
  // Project only live entitlement without consuming the runtime's captured grant.
  expireCharges(state.spearIlluminated, input.time);
  return {
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips,
    [STATE.JUSTICE_ACTIVE_ARMED]: state.justiceActiveArmed,
    [STATE.SYMBOLIC_AVENGER_EXPIRATIONS]: state.symbolicAvengerExpirations,
    [STATE.SYMBOL_IGNITION_STARTS_AT]: state.symbolIgnitionStartsAt,
    [STATE.SYMBOL_IGNITION_UNTIL]: state.symbolIgnitionUntil,
    [STATE.RESOLUTION_UNTIL]: state.resolutionUntil,
    [STATE.SPEAR_ILLUMINATED]: state.spearIlluminated,
    [STATE.SPEAR_LUMINANCE_UNTIL]: state.spearLuminanceUntil
  };
}
