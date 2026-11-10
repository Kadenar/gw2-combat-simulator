import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { activeChargeGrants, appendChargeGrant, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireEffect, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  coinInitiative,
  startDoubleEdge,
  tossCanachCoins
} from '#gw2/professions/thief/specializations/antiquary/skills/double-edge.js';
import { startForgedSurfer } from '#gw2/professions/thief/specializations/antiquary/skills/forged-surfer.js';
import { completeSkrittScuffle } from '#gw2/professions/thief/specializations/antiquary/skills/skritt-scuffle.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import {
  artifactWindowDuration,
  meticulousKryptisDuration
} from '#gw2/professions/thief/specializations/antiquary/traits/meticulous-custodian.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Artifact skills own their effects; the inventory lifecycle owns spending and reward ordering. */
export const antiquaryArtifactActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> =
  {
    'thief.double-edge'(runtime, context) {
      if (context.kind === 'cast') startDoubleEdge(runtime, context.cast);
    },
    'thief.roll-coins'(runtime, context) {
      if (context.kind === 'cast')
        coinInitiative.set(
          context.cast,
          tossCanachCoins(runtime, Boolean(antiquaryState.from(runtime.profession).backfireState[context.skill.id]))
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
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime, context.skill);
      // Guitar replaces the active bonus-attack grant with the selected artifact count and lifetime.
      state.bonusStealthAttack = grantCharges(skillNumber(context.skill, 'maximumStacks'), at + duration);
    },
    'thief.mortar'(runtime, context) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime, context.skill);

      if (!requireEffect(context.skill, 'condition', CONDITION.BURNING, requireSkillAction(context.skill, 'charged')))
        return;

      state.mistburn = grantCharges(skillNumber(context.skill, 'maximumStacks'), at + duration);
    },
    'thief.kryptis'(runtime) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      state.kryptisDamageUntil = at + meticulousKryptisDuration(runtime);
    },
    'thief.chak'(runtime, context) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime, context.skill);
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
    'thief.holo'(runtime, context) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime, context.skill);
      // Store the exact canonical deadline so an expiry-tick utility cannot spend this grant.
      state.holoUtilityCooldownReductionExpirations = [
        ...state.holoUtilityCooldownReductionExpirations,
        canonicalTime(at + duration)
      ];
    },
    'thief.surfer-window'(runtime, context) {
      const state = antiquaryState.from(runtime.profession);
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
