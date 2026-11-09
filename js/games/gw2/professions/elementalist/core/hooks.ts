import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER, RECORD_OBSERVATION_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { resolveSkillSelector } from '#gw2/platform/skills/selectors.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  elementalistCoreSideEffectHandlers,
  elementalistOnCastCommit,
  elementalistOnCastStart
} from '#gw2/professions/elementalist/core/cast-lifecycle.js';
import { CONJURED_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistBuffPolicies, elementalistEffectStates } from '#gw2/professions/elementalist/core/effect-state.js';
import { resetElementalistAttunementCooldowns } from '#gw2/professions/elementalist/core/mechanics/attunement-cooldowns.js';
import {
  acceptElementalistAuraReaction,
  elementalistAuraLifecycle,
  prepareElementalistAura
} from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { elementalistCoreAvailability } from '#gw2/professions/elementalist/core/mechanics/availability.js';
import { elementalistConjureLifecycle } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import { elementalistElementalCompanionId } from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { elementalistElementalLifecycle } from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { elementalistEndurance } from '#gw2/professions/elementalist/core/mechanics/endurance.js';
import { elementalistHammerOrbLifecycle } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { prepareElementalistHitboxEvent } from '#gw2/professions/elementalist/core/mechanics/hitbox.js';
import {
  applyShatteringStoneBuff,
  elementalistPistolLifecycle,
  triggerShatteringStone
} from '#gw2/professions/elementalist/core/mechanics/pistol.js';
import { elementalistRechargeWork } from '#gw2/professions/elementalist/core/mechanics/recharge.js';
import { elementalistRockBarrierLifecycle } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import {
  elementalistSpearLifecycle,
  finishElementalistSpearCast,
  prepareElementalistSpearEvent
} from '#gw2/professions/elementalist/core/mechanics/spear.js';
import {
  auraAccepted,
  controlAccepted,
  elementalistConditionApplied,
  elementalistDamageResolved,
  elementalistEventPreparing
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { elementalistWeaponStateLifecycle } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { shareHeatSyncBoon } from '#gw2/professions/elementalist/core/skills/weapons/warhorn.js';
import { validateElementalistGlyphs } from '#gw2/professions/elementalist/data/glyphs.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Registers cast, resource, and reaction callbacks with the callbacks from each Core mechanic. */
export const elementalistCoreHooks = composeRuntimeHooks<ElementalistRuntimeState, ElementalistSkill>([
  elementalistElementalLifecycle,
  elementalistWeaponStateLifecycle,
  elementalistRockBarrierLifecycle,
  elementalistAuraLifecycle,
  elementalistConjureLifecycle,
  elementalistHammerOrbLifecycle,
  elementalistSpearLifecycle,
  elementalistPistolLifecycle,
  {
    // Validate the selected runtime catalog, including patches, before any glyph can be cast.
    initialize(context) {
      validateElementalistGlyphs(context.helpers);
    },
    buffPolicies: (runtime) => elementalistBuffPolicies(runtime.helpers),
    observeEffects: elementalistEffectStates,
    sideEffectHandlers: elementalistCoreSideEffectHandlers,
    endurance: elementalistEndurance,
    availability: elementalistCoreAvailability,
    // Generic glyphs follow live attunement; a swap drops an equipped conjure before any weapon-set change.
    resolveCastSkill(context, skill) {
      if (skill.id !== SHARED_SKILL_IDS.SWAP_WEAPONS || !context.profession.core.conjureEquipped)
        return resolveSkillSelector(context.helpers, skill, context.profession.core.primaryAttunement);

      const drop = context.helpers.skillsById.get(ID.DROP_BUNDLE);

      if (!drop) throw new Error('Elementalist conjures require a Drop Bundle action.');

      return drop;
    },
    rechargeWork: elementalistRechargeWork,
    prepareEvent(runtime, event) {
      // Native and combo aura grants share the same one-time preparation before acceptance.
      event = prepareElementalistAura(runtime.helpers, runtime, event);
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
      return prepareElementalistSpearEvent(runtime, prepared);
    },
    onCastStart(runtime, cast) {
      if (!cast.cancelledBeforeCommit) elementalistOnCastStart(runtime, cast, cast.skill);
    },
    onCastCommit(runtime, cast) {
      elementalistOnCastCommit(runtime, cast, cast.skill);
      finishElementalistSpearCast(runtime, cast);
    },
    onCooldownReset: resetElementalistAttunementCooldowns,
    eventHandlers: {
      'elementalist.conjure': OBSERVABLE_EVENT_HANDLER,
      // Transition observations remain in executed history without replaying their mechanics.
      'elementalist.attunement': RECORD_OBSERVATION_EVENT_HANDLER,
      'elementalist.attunement-enter': RECORD_OBSERVATION_EVENT_HANDLER
    },
    reactions: {
      'damage.resolved'(runtime, event, details) {
        runtime.fireTrigger(elementalistDamageResolved, { cause: event, details });
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
