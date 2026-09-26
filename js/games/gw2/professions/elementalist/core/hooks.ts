import { observeElementalistTransition } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import type { RuntimeProfession, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type {
  ElementalistRuntimeState,
  ElementalistSkill,
  ElementalistSimulationEvent
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  elementalistOnCastStart,
  elementalistOnCastComplete
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
import { elementalistSignetTasks } from '#gw2/professions/elementalist/core/mechanics/signets.js';
import {
  elementalistSpearMechanicHandlers,
  empowerElementalistSpearPacket
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { expireElementalistState } from '#gw2/professions/elementalist/core/mechanics/expiry.js';
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
import {
  emitElementalistPacket,
  emitElementalistDamage,
  withElementalistCast
} from '#gw2/professions/elementalist/core/events.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  resetElementalistAttunementCooldowns
} from '#gw2/professions/elementalist/core/state.js';
import { HAMMER_ORB_SKILLS, CONJURED_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Core casts, accepted hits, and owned expiry tasks share the runtime. */
export const elementalistCoreHooks: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
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
      canonicalTime(event.at) > runtime.time
    )
      runtime.profession.core.freshAirCandidates.push({ at: canonicalTime(event.at), eventOrder: 0 });
    // Orb contacts stay cancellable until impact, so Grand Finale can retire their pending work.
    if (
      HAMMER_ORB_SKILLS[Number(event.skillId)] &&
      (event.type === 'damage' || event.type === 'condition') &&
      canonicalTime(event.at) > runtime.time
    ) {
      runtime.schedule('elementalist.packet', event.at, event, { id: String(event.activationId), generation: 0 });
      return null;
    }

    let prepared = prepareGw2BuffCompanionCandidates(
      event,
      elemental.element && elemental.activeUntil >= event.at
        ? [elementalistElementalCompanionId(elemental.summonGeneration)]
        : []
    );
    prepared = prepareElementalistHitboxEvent(runtime, prepared);
    if (prepared.type === 'damage' && prepared.skillId === ID.FRIGID_FLURRY)
      prepared = {
        ...prepared,
        comboFinishers: [
          {
            ownerId: 'elementalist',
            attemptGroup: `frigid-flurry:${prepared.hitIndex ?? 1}`,
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      };
    return empowerElementalistSpearPacket(runtime, prepared as ElementalistSimulationEvent);
  },
  modifyEffects(runtime, cast, effects) {
    if (cast.skill.id === ID.GRAND_FINALE) return [];
    return extendPersistingFlamesEffects(runtime, cast.skill, effects);
  },
  modifyComboFields: extendPersistingFlamesFields,
  onCastStart(runtime, cast) {
    if (!cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd))
      withElementalistCast(runtime, cast, () => elementalistOnCastStart(runtime, cast, cast.skill));
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    withElementalistCast(runtime, cast, () => elementalistOnCastComplete(runtime, cast, cast.skill));
    for (const trigger of (cast.skill as ElementalistSkill).elementalistTasks ?? []) {
      const scale =
        trigger.timingScale === 'cast' && Number(cast.skill.castTimeMs) > 0
          ? ((cast.fullEnd - cast.start) * 1000) / Number(cast.skill.castTimeMs)
          : 1;
      const at =
        (trigger.timingAnchor === 'castStart' ? cast.start : cast.effectiveEnd) +
        (Number(trigger.atMs ?? 0) * scale) / 1000;
      runtime.schedule(trigger.type, Math.max(runtime.time, at), cast);
    }
  },
  onAutoattackChainTransition: observeElementalistAutoattackTransition,
  onCooldownReset: resetElementalistAttunementCooldowns,
  tasks: {
    ...elementalistElementalTasks,
    ...elementalistWeaponStateTasks,
    ...elementalistRockBarrierTasks,
    ...elementalistSignetTasks,
    ...elementalistSpearMechanicHandlers,
    'elementalist.expire-state': expireElementalistState,
    'elementalist.packet': (runtime, data) => emitElementalistPacket(runtime, data as SimulationEventBase),
    'elementalist.fulgor-pulse'(runtime, data) {
      emitElementalistDamage(runtime, { ...(data as SimulationEventBase & { coefficient: number }), at: runtime.time });
    },
    'elementalist.core.consume-elemental-explosion'(runtime, data) {
      const cast = data as RuntimeCast;
      const effect = requireEffect(
        requireBalanceProfileFromContext(runtime, PROFILE.elementalExplosion),
        'buff',
        runtime.profession.core.primaryAttunement
      );
      if (effect)
        applyElementalistAura(runtime, {
          at: runtime.time,
          aura: String(effect.kind),
          duration: Number(effect.duration),
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
    'elementalist.attunement-enter': observeElementalistTransition,
    'elementalist.signet-fire': OBSERVABLE_EVENT_HANDLER
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      const damage = details as NativeResolvedDamageDetails;
      applyFreshAirCritical(runtime, event, damage.hitContext!.critical);
      for (const reaction of elementalistCoreCriticalReactions) reaction.handler(runtime, event, damage);
      applyElementalistResolvedDamage(runtime, event, damage);
    },
    'condition.applied': applyElementalistResolvedCondition,
    'buff.applied': applyElementalistResolverBuff,
    'control.resolved': observeElementalistTraitEvent,
    'aura.applied': applyElementalistResolverAura
  }
};
