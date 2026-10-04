import {
  ELEMENTALIST_TRAIT_IDS as DAMAGE_TRAIT,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import {
  emitElectricDischarge,
  emitEarthenBlast,
  emitSunspot,
  emitFlameExpulsion
} from '#gw2/professions/elementalist/core/traits/attunements.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeProfession, SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';
import {
  elementalistCoreSideEffectHandlers,
  elementalistOnCastCommit,
  elementalistOnCastStart
} from '#gw2/professions/elementalist/core/cast-lifecycle.js';
import { CONJURED_WEAPONS, HAMMER_ORB_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
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
  applyElementalistResolvedCondition,
  applyElementalistResolvedDamage,
  applyElementalistResolverAura,
  applyElementalistResolverBuff
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import {
  elementalistRechargeWork,
  reserveElementalistRecharge
} from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { elementalistRockBarrierTasks } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import {
  elementalistSpearMechanicHandlers,
  empowerElementalistSpearPacket
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import {
  elementalistWeaponStateTasks,
  observeElementalistAutoattackTransition
} from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  resetElementalistAttunementCooldowns
} from '#gw2/professions/elementalist/core/state.js';
import {
  applyFreshAirCritical,
  observeFreshAirCandidate
} from '#gw2/professions/elementalist/core/traits/critical-procs.js';
import {
  applyElementalistAura,
  observeElementalistTraitEvent,
  reactElementalistCoreCritical
} from '#gw2/professions/elementalist/core/traits/dispatch.js';
import type {
  ElementalistRuntimeState,
  ElementalistSimulationEvent,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
/** Core casts, accepted hits, and owned expiry tasks share the runtime. */
import { elementalistBuffPolicies, elementalistEffectStates } from '#gw2/professions/elementalist/core/effect-state.js';

export const elementalistCoreHooks: Partial<RuntimeProfession<ElementalistRuntimeState, ElementalistSkill>> = {
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
    if (skill.weapon && CONJURED_WEAPONS.has(skill.weapon)) state.conjureEquipped = skill.weapon;
    if (skill.id === ID.GRAND_FINALE)
      for (const element of ELEMENTALIST_ATTUNEMENTS)
        state.hammerOrbs[element] = inputs[`orb:${element}`] ? 3600 : null;
  },

  buffPolicies: elementalistBuffPolicies,
  observeEffects: elementalistEffectStates,
  sideEffectHandlers: elementalistCoreSideEffectHandlers,
  endurance: elementalistEndurance,
  availability: elementalistCoreAvailability,
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
    observeFreshAirCandidate(runtime, event);
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
    'elementalist.aura'(runtime, event) {
      runtime.history.push(event);
      applyElementalistResolverAura(runtime, event);
      runtime.schedule('elementalist.expire-state', event.at + Number(event.duration), null);
    },
    'elementalist.attunement-enter': observeElementalistTransition
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      const damage = details as NativeResolvedDamageDetails;
      applyFreshAirCritical(runtime, event, damage.hitContext!.critical);
      reactElementalistCoreCritical(runtime, event, damage);
      applyElementalistResolvedDamage(runtime, event);
    },
    'condition.applied': applyElementalistResolvedCondition,
    'buff.applied': applyElementalistResolverBuff,
    'control.resolved': observeElementalistTraitEvent,
    'aura.applied': applyElementalistResolverAura
  }
};
