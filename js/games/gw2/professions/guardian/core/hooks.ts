import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import { balanceNumber } from '#gw2/platform/skills/balance-profiles.js';
import { guardianBuffPolicies, guardianEffectStates } from '#gw2/professions/guardian/core/effect-state.js';
import { expireSpearIllumination, GUARDIAN_SPEAR_EXPIRY } from '#gw2/professions/guardian/core/mechanics/spear.js';
import {
  guardianBuffApplied,
  guardianCastCompleted,
  guardianStruck
} from '#gw2/professions/guardian/core/mechanics/trigger-points.js';
import {
  admitVirtueActivation,
  applyJusticeBurn,
  completeVirtueActivation,
  reactToJusticeHitWithOptions
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
import { CORE_VIRTUES, guardianVirtueActions } from '#gw2/professions/guardian/virtue-readiness.js';

/** Registers virtue, symbol, and follow-up callbacks with the actions from each Core skill. */
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
          maximumStacks: balanceNumber(runtime.helpers, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER, 'maximumStacks'),
          retain: 'latest-expiry'
        });
      }
    },
    buffPolicies: (runtime) => guardianBuffPolicies(runtime.helpers),
    observeEffects: guardianEffectStates,
    sideEffectHandlers: guardianVirtueActions,
    endurance: {
      state: (runtime) => runtime.profession.core.endurance,
      maximum: () => ENDURANCE.maximum,
      regenerationRate: () => 0
    },
    // Select weapon fields before trait extensions; Writ never changes an already executed field. Trait hooks compose
    // ahead of this hook, so the two duration extensions are applied here to reach the selected Symbol of Ignition field.
    modifyComboFields(runtime, cast, fields) {
      if (cast.skill.id === ID.SYMBOL_OF_IGNITION) fields = guardianIgnitionFields(runtime);

      return writOfPersistenceFields(runtime, cast.skill, masterOfConsecrationsFields(runtime, cast, fields));
    },
    availability(runtime, skill) {
      const flips = runtime.flips;

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
    reactions: {
      'damage.resolved'(runtime, event, details) {
        const hit = details.hitContext;
        const damage = hit.damage;

        // Weapon ignition precedes Zeal rewards, which precede Core passive Justice.
        if (event.actorType === ACTOR.PLAYER && Number(event.coefficient) > 0 && damage > 0)
          reactToSymbolOfIgnition(runtime, event);

        if (event.actorType === ACTOR.PLAYER && Number(event.coefficient) > 0 && damage > 0)
          runtime.fireTrigger(guardianStruck, {
            cause: event,
            targetHealthFractionBefore: hit.targetHealthFractionBefore
          });

        if (runtime.profession.specialization.kind !== 'Core') return;

        reactToJusticeHitWithOptions(runtime, event);
      },
      'buff.applied'(runtime, event) {
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
