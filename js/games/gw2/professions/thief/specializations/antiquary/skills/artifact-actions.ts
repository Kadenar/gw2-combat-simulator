import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  allArtifactChoices,
  completeSkrittSwipe,
  notifyArtifactTraits,
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
import { applyRepeatRansacker } from '#gw2/professions/thief/specializations/antiquary/traits/behavior.js';
import {
  artifactWindow,
  meticulousKryptisDuration
} from '#gw2/professions/thief/specializations/antiquary/traits/meticulous-custodian.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** This skill family owns its actions; hooks retain registration and cross-owner ordering. */
export const antiquaryArtifactActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> =
  {
    'thief.artifact-spend'(runtime, context) {
      if (context.kind === 'cast') spendArtifact(runtime, context.cast);
    },
    'thief.artifact-traits'(runtime, context) {
      if (context.kind === 'cast') notifyArtifactTraits(runtime, context.cast);
    },
    'thief.repeat-ransacker': applyRepeatRansacker,
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
      const { duration } = artifactWindow(runtime);
      state.chakInitiativeRefundUntil = at + duration;
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
      const { duration } = artifactWindow(runtime);
      state.forgedSurferBombDropUntil = at + duration;
    }
  };
