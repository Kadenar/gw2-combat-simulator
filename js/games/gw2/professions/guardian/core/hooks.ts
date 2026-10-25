import { ACTOR, BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';

import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { guardianBuffPolicies, guardianEffectStates } from '#gw2/professions/guardian/core/effect-state.js';
import {
  guardianBuffApplied,
  guardianCastCompleted,
  guardianStruck
} from '#gw2/professions/guardian/core/mechanics/trigger-points.js';
import { expireSpearIllumination, GUARDIAN_SPEAR_EXPIRY } from '#gw2/professions/guardian/core/mechanics/spear.js';
import {
  admitVirtueActivation,
  applyJusticeBurn,
  completeVirtueActivation,
  CORE_VIRTUES,
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions,
  refreshGuardianVirtues
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { guardianJusticeLifecycle } from '#gw2/professions/guardian/core/skills/profession-skills.js';
import {
  guardianIgnitionFields,
  guardianIgnitionLifecycle,
  reactToSymbolOfIgnition
} from '#gw2/professions/guardian/core/skills/weapons/pistol.js';
import { guardianSpearLifecycle } from '#gw2/professions/guardian/core/skills/weapons/spear.js';
import { guardianTorchLifecycle } from '#gw2/professions/guardian/core/skills/weapons/torch.js';
import { writOfPersistenceFields } from '#gw2/professions/guardian/core/traits/honor/writ-of-persistence.js';
import { masterOfConsecrationsFields } from '#gw2/professions/guardian/core/traits/virtues/index.js';
import { GUARDIAN_TRAIT_IDS, GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Shared virtue, symbol, and follow-up wiring composed with each Core skill owner's registered actions. */
export const guardianCoreHooks = composeRuntimeHooks<GuardianRuntimeState, GuardianSkill>([
  guardianTorchLifecycle,
  guardianSpearLifecycle,
  guardianIgnitionLifecycle,
  guardianJusticeLifecycle,
  {
    // Known damage payloads are invoked once without their activation requirements.
    damageEffects: [false, true].map((active) => ({
      id: `justice-${active ? 'active' : 'passive'}`,
      name: `Justice (${active ? 'active' : 'passive'})`,
      source: 'Profession' as const,
      unit: 'occurrence' as const,
      sourceIds: [`guardian.justice-${active ? 'active' : 'passive'}`],
      emit: (runtime) => applyJusticeBurn(runtime, damageInputEvent(runtime), { active })
    })),

    /** Initial effect assumptions seed the existing stack owner, which keeps normal expiry and grant behavior. */
    initialize(runtime) {
      for (const buff of runtime.config.initialBuffs ?? []) {
        if (buff.kind !== 'symbolic-avenger') continue;

        runtime.profession.core.symbolicAvengerExpirations = grantTimedStacks([], {
          at: runtime.time,
          expiresAt: runtime.time + buff.duration,
          count: buff.stacks,
          maximumStacks: balanceNumberFromContext(runtime, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER, 'maximumStacks'),
          retain: 'latest-expiry'
        });
      }
    },
    buffPolicies: guardianBuffPolicies,
    observeEffects: guardianEffectStates,
    sideEffectHandlers: {
      // Declared follow-ups retain their selected recharge-derived lifetime without a global completion fallback.
      'guardian.arm-follow-up'(runtime, context) {
        const skill = context.skill;
        runtime.armFlip(skill.flipSkillId!, {
          expiresAt: runtime.time + (skill.flipDuration ?? Math.max(1, skill.cooldown ?? 5)),
          expiryPriority: -220
        });
      },
      // Elite virtue IDs are absent from other catalogs; select live IDs before using the shared reset action.
      'guardian.refresh-virtues'(runtime, context) {
        const virtues = runtime.helpers.skills.filter(
          (skill) => skill.categories?.includes('Virtue') && guardianVirtueForSlot(skill.slot)
        );
        applySideEffect(runtime, context, { type: 'rechargeReset', skillIds: virtues.map((skill) => skill.id) });
        for (const skill of virtues) runtime.cooldownController.restoreAmmo(skill, Infinity, runtime.time);
        runtime.profession.core.virtueReadyAt = { justice: runtime.time, resolve: runtime.time, courage: runtime.time };
      }
    },
    endurance: { state: (runtime) => runtime.profession.core.endurance, maximum: () => 100, regenerationRate: () => 0 },
    // Select weapon fields before trait extensions; Writ never changes an already executed field. Trait hooks compose
    // ahead of this hook, so the two duration extensions are applied here to reach the selected Symbol of Ignition field.
    modifyComboFields(runtime, cast, fields) {
      if (cast.skill.id === ID.SYMBOL_OF_IGNITION) fields = guardianIgnitionFields(runtime);

      return writOfPersistenceFields(runtime, cast.skill, masterOfConsecrationsFields(runtime, cast, fields));
    },
    availability(runtime, skill) {
      const flips = runtime.profession.core.availableFlips;

      if (
        skill.flipParentId != null &&
        !skill.tags?.includes('specialization-managed-flip') &&
        !skillFlipReady(flips[skill.id], runtime.time)
      )
        return denySkillCast(skill, 'guardian.flip-not-armed', 'not currently armed.');

      return { ready: true };
    },
    onCastStart(runtime, cast) {
      const virtue = CORE_VIRTUES.find(([id]) => id === cast.skill.id)?.[1];

      if (virtue) admitVirtueActivation(runtime, cast, virtue);
    },
    onCastCommit(runtime, cast) {
      runtime.fireTrigger(guardianCastCompleted, { cast });
      const virtue = CORE_VIRTUES.find(([id]) => id === cast.skill.id)?.[1];

      if (virtue) completeVirtueActivation(runtime, cast, virtue);
    },
    onCooldownReset: refreshGuardianVirtues,
    reactions: {
      'damage.resolved'(runtime, event, details) {
        const damage = (details as NativeResolvedDamageDetails).hitContext?.damage ?? 0;

        // Weapon ignition precedes Zeal rewards, which precede Core passive Justice.
        if (event.actorType === ACTOR.PLAYER && Number(event.coefficient) > 0 && damage > 0)
          reactToSymbolOfIgnition(runtime, event);

        if (event.actorType === ACTOR.PLAYER && Number(event.coefficient) > 0 && damage > 0)
          runtime.fireTrigger(guardianStruck, { cause: event, damage });

        if (runtime.profession.specialization.kind !== 'Core') return;

        refreshGuardianVirtues(runtime);
        reactToJusticeHitWithOptions(runtime, event, details);
      },
      'buff.applied'(runtime, event) {
        if (event.kind === boonKey(BOON.ALACRITY)) refreshGuardianVirtues(runtime);

        runtime.fireTrigger(guardianBuffApplied, { cause: event });
      },
      'condition.applied'(runtime, event) {
        reactToSymbolOfIgnition(runtime, event);
      }
    },
    tasks: {
      [GUARDIAN_SPEAR_EXPIRY]: expireSpearIllumination
    }
  }
]);
