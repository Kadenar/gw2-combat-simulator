import { activeChargeGrants, appendChargeGrant, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  allArtifactChoices,
  completeSkrittSwipe,
  artifactSlotsUsed,
  spendArtifact
} from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import {
  coinInitiative,
  startDoubleEdge,
  tossCanachCoins
} from '#gw2/professions/thief/specializations/antiquary/skills/double-edge.js';
import { startForgedSurfer } from '#gw2/professions/thief/specializations/antiquary/skills/forged-surfer.js';
import { completeSkrittScuffle } from '#gw2/professions/thief/specializations/antiquary/skills/skritt-scuffle.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import {
  artifactActivated,
  artifactCompleted
} from '#gw2/professions/thief/specializations/antiquary/mechanics/boundaries.js';
import {
  artifactWindow,
  forgedSurferProfile,
  meticulousKryptisDuration
} from '#gw2/professions/thief/specializations/antiquary/traits/meticulous-custodian.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** This skill family owns its actions; hooks retain registration and cross-owner ordering. */
export const antiquaryArtifactActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> =
  {
    'thief.artifact-spend'(runtime, context) {
      if (context.kind === 'cast') spendArtifact(runtime, context.cast);
    },
    'thief.artifact-activated'(runtime, context) {
      // Family rewards use the spent slot before the skill grants its identity window.
      if (context.kind === 'cast')
        runtime.fireTrigger(artifactActivated, { cast: context.cast, slot: artifactSlotsUsed.get(context.cast) });
    },
    'thief.artifact-completed'(runtime, context) {
      if (context.kind === 'cast') runtime.fireTrigger(artifactCompleted, { cast: context.cast });
    },
    'thief.skritt-swipe'(runtime, context) {
      if (context.kind === 'cast') completeSkrittSwipe(runtime, context.cast);
    },
    'thief.reshuffle'(runtime) {
      antiquaryState.from(runtime).artifactSlots = allArtifactChoices();
    },
    'thief.double-edge'(runtime, context) {
      if (context.kind === 'cast') startDoubleEdge(runtime, context.cast);
    },
    'thief.roll-coins'(runtime, context) {
      if (context.kind === 'cast')
        coinInitiative.set(
          context.cast,
          tossCanachCoins(runtime, Boolean(antiquaryState.from(runtime).backfireState[context.skill.id]))
        );
    },
    'thief.pay-coins'(runtime, context) {
      if (context.kind === 'cast') {
        const initiativeGain = coinInitiative.get(context.cast) ?? 0;
        if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
      }
    },
    'thief.forged-surfer'(runtime, context) {
      startForgedSurfer(runtime, context.skill);
    },
    'thief.skritt-scuffle'(runtime) {
      completeSkrittScuffle(runtime);
    },
    'thief.guitar'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { windows, duration } = artifactWindow(runtime);
      // Guitar replaces the active bonus-attack grant with the selected artifact count and lifetime.
      state.bonusStealthAttack = grantCharges(balanceProfileNumber(windows, 'resourceGain'), at + duration);
    },
    'thief.mortar'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { windows, duration } = artifactWindow(runtime);
      if (!requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.mistburnProc), 'condition', 'Burning'))
        return;
      state.mistburn = grantCharges(balanceProfileNumber(windows, 'playerStacks'), at + duration);
    },
    'thief.kryptis'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      state.kryptisDamageUntil = at + meticulousKryptisDuration(runtime);
    },
    'thief.chak'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { windows, duration } = artifactWindow(runtime);
      // Three refunds are added up to four total; unused grants keep their own expiry instead of becoming permanent.
      const grants = activeChargeGrants(state.chakInitiativeRefunds, at);
      const remaining = grants.reduce((sum, grant) => sum + grant.charges, 0);
      const added = Math.max(
        0,
        Math.min(
          balanceProfileNumber(windows, 'resourceGain'),
          balanceProfileNumber(windows, 'chakRefundMaximum') - remaining
        )
      );
      state.chakInitiativeRefunds = appendChargeGrant(
        grants,
        grantCharges(added, at + duration),
        at,
        'earliest-expiry'
      );
    },
    'thief.holo'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { duration } = artifactWindow(runtime);
      state.holoUtilityCooldownReductionExpirations = [...state.holoUtilityCooldownReductionExpirations, at + duration];
    },
    'thief.surfer-window'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const duration = balanceProfileNumber(forgedSurferProfile(runtime), 'durationMultiplier');
      const maximum = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, PROFILE.forgedSurfer),
        'maximumDuration'
      );
      // Surfer banks remaining duration up to its own cap, independently of the other artifact windows.
      state.forgedSurferBombDropUntil =
        at + Math.min(maximum, Math.max(0, state.forgedSurferBombDropUntil - at) + duration);
    }
  };
