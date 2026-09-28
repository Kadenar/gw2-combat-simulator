import { observeElementalistTransition } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import type { RuntimeProfession, SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { ElementalistRuntimeState, ElementalistSimulationEvent } from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  elementalistCoreSideEffectHandlers,
  elementalistOnCastStart,
  elementalistOnCastCommit
} from '#gw2/professions/elementalist/core/cast-lifecycle.js';
import { elementalistEndurance } from '#gw2/professions/elementalist/core/mechanics/endurance.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import {
  elementalistRechargeWork,
  reserveElementalistRecharge
} from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { prepareElementalistHitboxEvent } from '#gw2/professions/elementalist/core/mechanics/hitbox.js';
import {
  elementalistElementalCompanionId,
  elementalistElementalTasks,
  ensureElementalistElemental
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import {
  elementalistWeaponStateTasks,
  observeElementalistAutoattackTransition
} from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { elementalistRockBarrierTasks } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import {
  elementalistSpearMechanicHandlers,
  empowerElementalistSpearPacket
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { expireElementalistState } from '#gw2/professions/elementalist/core/mechanics/expiry.js';
import { fulgorPulse } from '#gw2/professions/elementalist/core/mechanics/fulgor.js';
import { applyFreshAirCritical } from '#gw2/professions/elementalist/core/traits/air.js';
import {
  applyElementalistAura,
  observeElementalistTraitEvent
} from '#gw2/professions/elementalist/core/traits/index.js';
import {
  extendPersistingFlamesEffects,
  extendPersistingFlamesFields
} from '#gw2/professions/elementalist/core/traits/fire.js';
import {
  applyElementalistResolverAura,
  applyElementalistResolverBuff,
  applyElementalistResolvedCondition,
  applyElementalistResolvedDamage,
  elementalistCoreCriticalReactions
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  resetElementalistAttunementCooldowns
} from '#gw2/professions/elementalist/core/state.js';
import { HAMMER_ORB_SKILLS, CONJURED_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/** Core casts, accepted hits, and owned expiry tasks share the runtime. */
export const elementalistCoreHooks: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
  sideEffectHandlers: elementalistCoreSideEffectHandlers,
  endurance: elementalistEndurance,
  availability: elementalistCoreAvailability,
  rechargeWork: elementalistRechargeWork,
  reserveRecharge: reserveElementalistRecharge,
  onCombatStart: ensureElementalistElemental,
  prepareEvent(runtime, event) {
    const elemental = runtime.profession.core.summonedElemental;
    if (event.type === 'damage' && CONJURED_WEAPONS.has(String(event.skillWeapon)))
      event = { ...event, weaponStrengthSource: 'equipped' };
    if (
      event.type === 'damage' &&
      event.actorType === 'player' &&
      Number(event.coefficient) > 0 &&
      canonicalTime(event.at) > runtime.time &&
      hasTrait(runtime, TRAIT.FRESH_AIR)
    ) {
      // Only Fresh Air needs strike wakes; retire elapsed times as new work arrives.
      const core = runtime.profession.core;
      core.freshAirCandidates = core.freshAirCandidates.filter((at) => at > runtime.time);
      core.freshAirCandidates.push(canonicalTime(event.at));
    }

    // Orb contacts stay cancellable until impact, so Grand Finale can retire their pending work.
    if (
      HAMMER_ORB_SKILLS[Number(event.skillId)] &&
      (event.type === 'damage' || event.type === 'condition') &&
      canonicalTime(event.at) > runtime.time
    ) {
      runtime.emitProcedural(event, { owner: { id: String(event.activationId), generation: 0 } });
      return null;
    }

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
      runtime.profession.core.spearFollowups[String(prepared.activationId)]
    );
  },
  modifyEffects(runtime, cast, effects) {
    return extendPersistingFlamesEffects(runtime, cast.skill, effects);
  },
  modifyComboFields: extendPersistingFlamesFields,
  onCastStart(runtime, cast) {
    if (!cast.cancelled) withElementalistCast(runtime, cast, () => elementalistOnCastStart(runtime, cast, cast.skill));
  },
  onCastCommit(runtime, cast) {
    withElementalistCast(runtime, cast, () => elementalistOnCastCommit(runtime, cast, cast.skill));
    // Authored strikes are prepared, and delayed sequences now own their snapshots.
    delete runtime.profession.core.spearFollowups[cast.id];
  },
  onAutoattackChainTransition: observeElementalistAutoattackTransition,
  onCooldownReset: resetElementalistAttunementCooldowns,
  tasks: {
    ...elementalistElementalTasks,
    ...elementalistWeaponStateTasks,
    ...elementalistRockBarrierTasks,
    ...elementalistSpearMechanicHandlers,
    'elementalist.expire-state': expireElementalistState,
    'elementalist.fulgor-pulse': fulgorPulse,
    'elementalist.core.consume-elemental-explosion'(runtime, data) {
      const { cast } = data as SkillTaskData;
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
    'elementalist.fresh-air': observeElementalistTransition,
    'elementalist.evasive-arcana': OBSERVABLE_EVENT_HANDLER,
    'elementalist.attunement-enter': observeElementalistTransition
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      const damage = details as NativeResolvedDamageDetails;
      applyFreshAirCritical(runtime, event, damage.hitContext!.critical);
      for (const reaction of elementalistCoreCriticalReactions) reaction(runtime, event, damage);
      applyElementalistResolvedDamage(runtime, event);
    },
    'condition.applied': applyElementalistResolvedCondition,
    'buff.applied': applyElementalistResolverBuff,
    'control.resolved': observeElementalistTraitEvent,
    'aura.applied': applyElementalistResolverAura
  }
};
