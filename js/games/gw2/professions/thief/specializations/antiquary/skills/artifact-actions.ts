import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { AntiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { activeChargeGrants, appendChargeGrant, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireEffect, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import {
  allArtifactChoices,
  completeSkrittSwipe,
  artifactSlotsUsed,
  spendArtifact
} from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
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
} from '#gw2/professions/thief/specializations/antiquary/mechanics/trigger-points.js';
import {
  artifactWindowDuration,
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
      if (context.kind === 'cast') runtime.fireTrigger(artifactCompleted);
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
    'thief.guitar'(runtime, context) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime);
      // Guitar replaces the active bonus-attack grant with the selected artifact count and lifetime.
      state.bonusStealthAttack = grantCharges(skillNumber(context.skill, 'maximumStacks'), at + duration);
    },
    'thief.mortar'(runtime, context) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime);

      if (!requireEffect(context.skill, 'condition', CONDITION.BURNING, requireSkillAction(context.skill, 'charged')))
        return;

      state.mistburn = grantCharges(skillNumber(context.skill, 'maximumStacks'), at + duration);
    },
    'thief.kryptis'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      state.kryptisDamageUntil = at + meticulousKryptisDuration(runtime);
    },
    'thief.chak'(runtime, context) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime);
      // Three refunds are added up to four total; unused grants keep their own expiry instead of becoming permanent.
      const grants = activeChargeGrants(state.chakInitiativeRefunds, at);
      const remaining = grants.reduce((sum, grant) => sum + grant.charges, 0);
      const added = Math.max(
        0,
        Math.min(skillNumber(context.skill, 'refundCharges'), skillNumber(context.skill, 'maximumStacks') - remaining)
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
      const duration = artifactWindowDuration(runtime);
      // Store the exact canonical deadline so an expiry-tick utility cannot spend this grant.
      state.holoUtilityCooldownReductionExpirations = [
        ...state.holoUtilityCooldownReductionExpirations,
        canonicalTime(at + duration)
      ];
    },
    'thief.surfer-window'(runtime, context) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const duration = skillNumber(
        context.skill,
        hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? 'enhancedDuration' : 'duration'
      );
      const maximum = skillNumber(context.skill, 'maximumDuration');
      // Surfer banks remaining duration up to its own cap, independently of the other artifact windows.
      state.forgedSurferBombDropUntil =
        at + Math.min(maximum, Math.max(0, state.forgedSurferBombDropUntil - at) + duration);
    }
  };

/** The turret artifact strengthens player-owned strikes until its accepted damage window expires. */
export const kryptisTurretModifiers = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    order: 403,
    id: 'thief.kryptis-turret-damage',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      (thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').kryptisDamageUntil || 0) > context.time
  }
]);
