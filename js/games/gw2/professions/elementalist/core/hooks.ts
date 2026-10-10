import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import type { SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  elementalistCoreSideEffectHandlers,
  elementalistOnCastCommit,
  elementalistOnCastStart
} from '#gw2/professions/elementalist/core/cast-lifecycle.js';
import { CONJURED_WEAPONS, HAMMER_ORB_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistBuffPolicies, elementalistEffectStates } from '#gw2/professions/elementalist/core/effect-state.js';
import {
  acceptElementalistAuraReaction,
  applyElementalistAura,
  resolveElementalistAura
} from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import {
  elementalistElementalCompanionId,
  elementalistElementalTasks,
  ensureElementalistElemental
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { observeElementalistTransition } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { elementalistEndurance } from '#gw2/professions/elementalist/core/mechanics/endurance.js';
import { expireElementalistState } from '#gw2/professions/elementalist/core/mechanics/expiry.js';
import { fulgorPulse } from '#gw2/professions/elementalist/core/mechanics/fulgor.js';
import { prepareElementalistHitboxEvent } from '#gw2/professions/elementalist/core/mechanics/hitbox.js';
import {
  elementalistRechargeWork,
  reserveElementalistRecharge
} from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { elementalistRockBarrierTasks } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import {
  completeElementalistSpearProgression,
  elementalistSpearMechanicHandlers,
  empowerElementalistSpearPacket
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import {
  auraAccepted,
  controlAccepted,
  elementalistConditionApplied,
  elementalistDamageResolved,
  elementalistEventPreparing
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import {
  elementalistWeaponStateTasks,
  observeElementalistAutoattackTransition
} from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import {
  applyShatteringStoneBuff,
  triggerShatteringStone
} from '#gw2/professions/elementalist/core/skills/weapons/pistol.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  resetElementalistAttunementCooldowns
} from '#gw2/professions/elementalist/core/state.js';
import { emitElectricDischarge } from '#gw2/professions/elementalist/core/traits/air/attunement-entry.js';
import { emitEarthenBlast } from '#gw2/professions/elementalist/core/traits/earth/attunement-entry.js';
import {
  emitFlameExpulsion,
  emitSunspot
} from '#gw2/professions/elementalist/core/traits/fire/attunement-transition.js';
import {
  ELEMENTALIST_TRAIT_IDS as DAMAGE_TRAIT,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntimeState,
  ElementalistSimulationEvent,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

export const elementalistCoreHooks: RuntimeHooks<ElementalistRuntimeState, ElementalistSkill> = {
  damageEffects: [
    {
      id: 'elementalist.ElectricDischarge',
      name: 'Electric Discharge',
      source: 'Trait',
      ownerId: DAMAGE_TRAIT.ELECTRIC_DISCHARGE,
      unit: 'occurrence',
      sourceIds: [DAMAGE_TRAIT.ELECTRIC_DISCHARGE],
      emit(runtime) {
        emitElectricDischarge(runtime, runtime.time, DAMAGE_TRAIT.ELECTRIC_DISCHARGE);
      }
    },
    {
      id: 'elementalist.EarthenBlast',
      name: 'Earthen Blast',
      source: 'Trait',
      ownerId: DAMAGE_TRAIT.EARTHEN_BLAST,
      unit: 'occurrence',
      sourceIds: [DAMAGE_TRAIT.EARTHEN_BLAST],
      emit(runtime) {
        emitEarthenBlast(runtime, runtime.time, DAMAGE_TRAIT.EARTHEN_BLAST);
      }
    },
    {
      id: 'elementalist.Sunspot',
      name: 'Sunspot',
      source: 'Trait',
      ownerId: DAMAGE_TRAIT.SUNSPOT,
      unit: 'occurrence',
      sourceIds: [DAMAGE_TRAIT.SUNSPOT],
      emit(runtime) {
        emitSunspot(runtime, runtime.time, DAMAGE_TRAIT.SUNSPOT, applyElementalistAura);
      }
    },
    {
      id: 'elementalist.FlameExpulsion',
      name: 'Flame Expulsion',
      source: 'Trait',
      ownerId: DAMAGE_TRAIT.PYROMANCERS_PUISSANCE,
      unit: 'occurrence',
      sourceIds: [DAMAGE_TRAIT.PYROMANCERS_PUISSANCE],
      emit(runtime) {
        emitFlameExpulsion(runtime, runtime.time, DAMAGE_TRAIT.PYROMANCERS_PUISSANCE);
      }
    }
  ],
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
  onCombatStart: ensureElementalistElemental,
  // Orb contact ownership is admission data; preparation waits until the surviving packet executes.
  effectOwner(_runtime, event) {
    if (HAMMER_ORB_SKILLS[Number(event.skillId)] && (event.type === 'damage' || event.type === 'condition'))
      return { id: String(event.activationId), generation: 0 };
    return undefined;
  },
  prepareEvent(runtime, event) {
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
  onAutoattackChainTransition: observeElementalistAutoattackTransition,
  onCooldownReset: resetElementalistAttunementCooldowns,
  // Physical elementals own independent attacks and expiry; their lifetime does not extend player skill previews.
  backgroundTasks: Object.keys(elementalistElementalTasks),
  tasks: {
    ...elementalistElementalTasks,
    ...elementalistWeaponStateTasks,
    ...elementalistRockBarrierTasks,
    ...elementalistSpearMechanicHandlers,
    'elementalist.expire-state': expireElementalistState,
    'elementalist.fulgor-pulse': fulgorPulse,
    'elementalist.core.consume-elemental-explosion'(runtime, data) {
      const { cast } = data as SkillTaskData<ElementalistSkill>;
      const effect = requireEffect(
        requireBalanceProfileFromContext(runtime, PROFILE.elementalExplosion),
        'buff',
        runtime.profession.core.primaryAttunement
      );
      if (effect)
        applyElementalistAura(runtime, {
          at: runtime.time,
          aura: String(effect.kind),
          duration: effect.duration,
          skillName: cast.skill.name,
          sourceId: cast.skill.id
        });
      for (const element of ELEMENTALIST_ATTUNEMENTS) runtime.profession.core.pistolBullets[element] = false;
    }
  },
  eventHandlers: {
    'elementalist.conjure': OBSERVABLE_EVENT_HANDLER,
    'elementalist.attunement': observeElementalistTransition,
    'elementalist.aura': resolveElementalistAura,
    'elementalist.attunement-enter': observeElementalistTransition
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      const damage = details as NativeResolvedDamageDetails;
      runtime.fireTrigger(elementalistDamageResolved, { cause: event, details: damage });
      triggerShatteringStone(runtime, event);
    },
    'condition.applied': (runtime, event) => runtime.fireTrigger(elementalistConditionApplied, { cause: event }),
    'buff.applied': applyShatteringStoneBuff,
    'control.resolved'(runtime, cause) {
      if (cause.type === 'control' && cause.actorType === 'player') runtime.fireTrigger(controlAccepted, { cause });
    },
    // Core consequences run before the composed elite reactions; combo auras are accepted without republishing.
    'aura.applied'(runtime, event) {
      if (acceptElementalistAuraReaction(runtime, event)) runtime.fireTrigger(auraAccepted, { cause: event });
    }
  }
};
