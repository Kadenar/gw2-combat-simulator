import { ACTOR } from '#gw2/platform/constants.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  elementalistCoreSideEffectHandlers,
  elementalistOnCastCommit,
  elementalistOnCastStart
} from '#gw2/professions/elementalist/core/cast-lifecycle.js';
import { CONJURED_WEAPONS, HAMMER_ORB_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistBuffPolicies, elementalistEffectStates } from '#gw2/professions/elementalist/core/effect-state.js';
import { resetElementalistAttunementCooldowns } from '#gw2/professions/elementalist/core/mechanics/attunement-cooldowns.js';
import {
  acceptElementalistAuraReaction,
  prepareElementalistAura
} from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { elementalistElementalCompanionId } from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { elementalistElementalLifecycle } from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { observeElementalistTransition } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { elementalistEndurance } from '#gw2/professions/elementalist/core/mechanics/endurance.js';
import { expireElementalistState } from '#gw2/professions/elementalist/core/mechanics/expiry.js';
import { fulgorPulse } from '#gw2/professions/elementalist/core/mechanics/fulgor.js';
import { prepareElementalistHitboxEvent } from '#gw2/professions/elementalist/core/mechanics/hitbox.js';
import {
  elementalistRechargeWork,
  reserveElementalistRecharge
} from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { elementalistRockBarrierLifecycle } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import {
  completeElementalistSpearProgression,
  elementalistSpearEmpowermentLifecycle,
  empowerElementalistSpearPacket
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import {
  auraAccepted,
  controlAccepted,
  elementalistConditionApplied,
  elementalistDamageResolved,
  elementalistEventPreparing
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { elementalistWeaponStateLifecycle } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import {
  applyShatteringStoneBuff,
  elementalistPistolLifecycle,
  triggerShatteringStone
} from '#gw2/professions/elementalist/core/skills/weapons/pistol.js';
import { shareHeatSyncBoon } from '#gw2/professions/elementalist/core/skills/weapons/warhorn.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntimeState,
  ElementalistSimulationEvent,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Shared cast, resource, and reaction wiring composed with each Core mechanic owner's registered work. */
export const elementalistCoreHooks = composeRuntimeHooks<ElementalistRuntimeState, ElementalistSkill>([
  elementalistElementalLifecycle,
  elementalistWeaponStateLifecycle,
  elementalistRockBarrierLifecycle,
  elementalistSpearEmpowermentLifecycle,
  elementalistPistolLifecycle,
  {
    /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
    prepareDamageState(runtime, skill, inputs) {
      const state = runtime.profession.core;

      if (skill?.weapon && CONJURED_WEAPONS.has(skill.weapon)) state.conjureEquipped = skill.weapon;

      if (skill?.id === ID.GRAND_FINALE)
        for (const element of ELEMENTALIST_ATTUNEMENTS)
          state.hammerOrbs[element] = inputs[`orb:${element}`] ? 3600 : null;
    },

    buffPolicies: elementalistBuffPolicies,
    observeEffects: elementalistEffectStates,
    sideEffectHandlers: elementalistCoreSideEffectHandlers,
    endurance: elementalistEndurance,
    availability: elementalistCoreAvailability,
    // The swap input drops a conjure first; only a later precombat input may change equipped weapon sets.
    resolveCastSkill(context, skill) {
      if (skill.id !== SHARED_SKILL_IDS.SWAP_WEAPONS || !context.profession.core.conjureEquipped) return skill;

      const drop = context.helpers.skillsById.get(ID.DROP_BUNDLE);

      if (!drop) throw new Error('Elementalist conjures require a Drop Bundle action.');

      return drop;
    },
    rechargeWork: elementalistRechargeWork,
    reserveRecharge: reserveElementalistRecharge,
    // Orb contact ownership is admission data; preparation waits until the surviving packet executes.
    effectOwner(_runtime, event) {
      if (HAMMER_ORB_SKILLS[Number(event.skillId)] && (event.type === 'damage' || event.type === 'condition'))
        return { id: String(event.activationId), generation: 0 };

      return undefined;
    },
    prepareEvent(runtime, event) {
      // Native and combo aura grants share the same one-time preparation before acceptance.
      event = prepareElementalistAura(runtime, event);
      const elemental = runtime.profession.core.summonedElemental;

      if (event.type === 'damage' && CONJURED_WEAPONS.has(String(event.skillWeapon)))
        event = { ...event, weaponStrengthSource: 'equipped' };

      runtime.fireTrigger(elementalistEventPreparing, { event });
      let prepared = prepareGw2BuffCompanionCandidates(
        event,
        elemental.element && elemental.activeUntil >= event.at
          ? [elementalistElementalCompanionId(elemental.summonGeneration)]
          : []
      );
      prepared = prepareElementalistHitboxEvent(runtime, prepared);
      return empowerElementalistSpearPacket(
        runtime,
        prepared as ElementalistSimulationEvent,
        runtime.profession.core.spearFollowups[String(prepared.activationId)],
        undefined
      );
    },
    onCastStart(runtime, cast) {
      if (!cast.cancelled) elementalistOnCastStart(runtime, cast, cast.skill);
    },
    onCastCommit(runtime, cast) {
      elementalistOnCastCommit(runtime, cast, cast.skill);
      // Authored strikes are prepared, and delayed sequences now own their snapshots.
      delete runtime.profession.core.spearFollowups[cast.id];
    },
    onCastCancel(runtime, cast) {
      // An activated skill still charges an etching when cancelled before its damage commits.
      // Zero-length cancellations never progress a cast; rejected skills never reach this hook.
      if (cast.effectiveEnd > cast.start) completeElementalistSpearProgression(runtime, cast.skill);

      delete runtime.profession.core.spearFollowups[cast.id];
    },
    onCooldownReset: resetElementalistAttunementCooldowns,
    tasks: {
      'elementalist.expire-state': expireElementalistState,
      'elementalist.fulgor-pulse': fulgorPulse
    },
    eventHandlers: {
      'elementalist.conjure': OBSERVABLE_EVENT_HANDLER,
      'elementalist.attunement': observeElementalistTransition,
      'elementalist.attunement-enter': observeElementalistTransition
    },
    reactions: {
      'damage.resolved'(runtime, event, details) {
        const damage = details as NativeResolvedDamageDetails;
        runtime.fireTrigger(elementalistDamageResolved, { cause: event, details: damage });
        triggerShatteringStone(runtime, event);
      },
      'condition.applied': (runtime, event) => runtime.fireTrigger(elementalistConditionApplied, { cause: event }),
      'buff.applied'(runtime, event) {
        applyShatteringStoneBuff(runtime, event);
        shareHeatSyncBoon(runtime, event);
      },
      'control.resolved'(runtime, cause) {
        if (cause.type === 'control' && cause.actorType === ACTOR.PLAYER)
          runtime.fireTrigger(controlAccepted, { cause });
      },
      // Core consequences run before the composed elite reactions; combo auras are accepted without republishing.
      'aura.applied'(runtime, event) {
        if (acceptElementalistAuraReaction(runtime, event)) runtime.fireTrigger(auraAccepted, { cause: event });
      }
    }
  }
]);
