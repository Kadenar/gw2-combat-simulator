// Private deadlines use the same 40 ms clock as scheduled events.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { createChargeGrant } from '#gw2/platform/combat/resources/charges.js';
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
import { appendBatch } from '#kernel/resources/batch-list.js';
import { createBatch } from '#kernel/resources/batch.js';

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
      // Keep each grant's expiry and insertion order so attacks can consume the newest live charges first.
      state.antiquaryGuitarCharges = appendBatch(
        state.antiquaryGuitarCharges,
        createChargeGrant(skillNumber(context.skill, 'antiquaryStealthAttackCharges'), at + duration),
        at,
        { order: 'insertion', maximum: skillNumber(context.skill, 'maximumStacks') }
      );
    },
    'thief.mortar'(runtime, context) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime, context.skill);

      if (!requireEffect(context.skill, 'condition', CONDITION.BURNING, requireSkillAction(context.skill, 'charged')))
        return;

      // Recasts add charges with their own expiry and preserve the shared proc cooldown.
      state.mistburn.grants = appendBatch(
        state.mistburn.grants,
        createBatch(skillNumber(context.skill, 'maximumStacks'), gw2Time(at + duration)),
        at,
        { order: 'insertion' }
      );
    },
    'thief.kryptis'(runtime) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      state.kryptisDamageUntil = gw2Time(at + meticulousKryptisDuration(runtime));
    },
    'thief.kryptis-mark'(runtime) {
      const state = antiquaryState.from(runtime.profession);
      // A landed turret hit enables the bonus only for the remaining player window, never a fresh full duration.
      state.antiquaryKryptisTargetUntil = Math.max(state.antiquaryKryptisTargetUntil, state.kryptisDamageUntil);
    },
    'thief.chak'(runtime, context) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime, context.skill);
      // Three refunds are added up to four total; unused grants keep their own expiry instead of becoming permanent.
      state.chakInitiativeRefunds = appendBatch(
        state.chakInitiativeRefunds,
        createChargeGrant(Math.max(0, skillNumber(context.skill, 'refundCharges')), at + duration),
        at,
        {
          order: 'earliest-expiry',
          maximum: skillNumber(context.skill, 'maximumStacks')
        }
      );
    },
    'thief.holo'(runtime, context) {
      const state = antiquaryState.from(runtime.profession);
      const at = runtime.time;
      const duration = artifactWindowDuration(runtime, context.skill);
      // Store the exact canonical deadline so an expiry-tick utility cannot spend this grant.
      state.holoUtilityCooldownReductionExpirations = [
        ...state.holoUtilityCooldownReductionExpirations,
        gw2Time(at + duration)
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
      // Recasting replaces the previous buff's remaining duration instead of banking it.
      state.forgedSurferBombDropUntil = gw2Time(at + Math.min(maximum, duration));
    }
  };
