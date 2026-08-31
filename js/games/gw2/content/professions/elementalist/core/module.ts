import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onAuraApplied, onConditionApplied, onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createElementalistModuleData } from '#gw2/content/professions/elementalist/catalog/module-data.js';
import {
  elementalistAfterCast,
  elementalistCoreSkillMechanicHandlers,
  elementalistOnCastComplete,
  elementalistOnCastStart,
  scheduleElementalistSkill
} from '#gw2/content/professions/elementalist/core/skills/cast-effects.js';
import { elementalistCoreCastRules } from '#gw2/content/professions/elementalist/core/skills/recharge.js';
import { elementalistCoreAttributeRules } from '#gw2/content/professions/elementalist/core/traits/modifiers.js';
import { projectElementalistEndState } from '#gw2/content/professions/elementalist/state.js';
import { createElementalistCoreState } from '#gw2/content/professions/elementalist/core/state.js';
import { bindElementalistCoreUi } from '#gw2/content/professions/elementalist/core/presentation.js';
import {
  ELEMENTALIST_CORE_EXTRA_SKILLS,
  ELEMENTALIST_CORE_SKILL_MECHANICS
} from '#gw2/content/professions/elementalist/core/skills/index.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILES } from '#gw2/content/professions/elementalist/core/profiles.js';
import {
  applyElementalistResolverAttunement,
  applyElementalistResolverAura,
  applyElementalistResolverSignetFire,
  applyElementalistResolvedCondition,
  applyElementalistResolvedDamage,
  elementalistCoreCriticalReactions
} from '#gw2/content/professions/elementalist/core/mechanics/reactions.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEventInput } from '#gw2/platform/engine/types.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';
import { resetElementalistAttunementCooldowns } from '#gw2/content/professions/elementalist/core/state.js';
import { prepareElementalistHitboxEvent } from '#gw2/content/professions/elementalist/core/mechanics/event-handlers.js';
import {
  advanceElementalistState,
  observeElementalistEvent
} from '#gw2/content/professions/elementalist/core/mechanics/transient-state.js';
import { elementalistWeaponStateTaskHandlers } from '#gw2/content/professions/elementalist/core/mechanics/weapon-state.js';
import {
  elementalistElementalCompanionId,
  elementalistElementalTaskHandlers
} from '#gw2/content/professions/elementalist/core/skills/elementals.js';

/** Registers ordered Core Elementalist hooks while implementations stay with their owning concepts. */
const elementalistCoreSchedulerHooks = Object.freeze({
  taskHandlers: Object.freeze({
    ...elementalistElementalTaskHandlers,
    ...elementalistWeaponStateTaskHandlers
  }),
  prepareEvent: Object.freeze([
    {
      id: 'elementalist.boon-companion-candidates',
      order: 5,
      // A live summoned elemental is an extra boon target, so it must be
      // offered as a companion candidate on every event while it is alive.
      handler(context: ElementalistSchedulerContext, event: SimulationEventInput): SimulationEventInput {
        const elemental = professionCoreState(context).summonedElemental;
        const active =
          elemental.element !== null &&
          elemental.activeUntil > Number(event.at ?? context.state.time) - context.epsilon;
        return prepareGw2BuffCompanionCandidates(
          event,
          active ? [elementalistElementalCompanionId(elemental.summonGeneration)] : []
        );
      }
    },
    {
      id: 'elementalist.hitbox',
      order: 10,
      handler: prepareElementalistHitboxEvent
    }
  ]),
  onCastStart: {
    id: 'elementalist.core-cast-start',
    order: 10,
    handler: elementalistOnCastStart
  },
  scheduleSkill: {
    id: 'elementalist.special-skill-profile',
    order: 10,
    handler: scheduleElementalistSkill
  },
  afterCast: {
    id: 'elementalist.core-after-cast',
    order: 10,
    handler: elementalistAfterCast
  },
  advance: {
    id: 'elementalist.core-state',
    order: 10,
    handler: advanceElementalistState
  },
  onEventScheduled: {
    id: 'elementalist.combos-and-fresh-air',
    order: 10,
    handler: observeElementalistEvent
  },
  onCastComplete: {
    id: 'elementalist.core-cast-complete',
    order: 10,
    handler: elementalistOnCastComplete
  },
  onCooldownReset: {
    id: 'elementalist.attunement-cooldown-reset',
    order: 10,
    handler: resetElementalistAttunementCooldowns
  }
});

/**
 * Core Elementalist module: binds the shared attunement/endurance state, its
 * cast, scheduler, and resolver hooks, and the Core UI into one registration
 * that every Elementalist specialization builds on.
 */
export const elementalistCoreModule = defineNativeModule({
  id: 'Core',
  data: createElementalistModuleData('Core', {
    skillMechanics: ELEMENTALIST_CORE_SKILL_MECHANICS,
    extraSkills: ELEMENTALIST_CORE_EXTRA_SKILLS,
    balanceProfiles: ELEMENTALIST_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createElementalistCoreState,
    resolver: createElementalistCoreState,
    project: projectElementalistEndState
  },
  mechanics: {
    modifiers: elementalistCoreAttributeRules,
    execution: {
      castRules: elementalistCoreCastRules,
      skillMechanicHandlers: elementalistCoreSkillMechanicHandlers,
      hooks: elementalistCoreSchedulerHooks
    },
    resolution: {
      reactions: [
        ...elementalistCoreCriticalReactions,
        onResolvedDamage({
          id: 'elementalist.core.damage',
          handler: applyElementalistResolvedDamage
        }),
        onConditionApplied({
          id: 'elementalist.core.condition',
          handler: applyElementalistResolvedCondition
        }),
        onAuraApplied({
          id: 'elementalist.core-aura',
          handler: applyElementalistResolverAura
        })
      ],
      hooks: {
        // The resolver throws on any event type without a registered handler,
        // so the marker-only scheduler events (Fresh Air, Evasive Arcana,
        // attunement entry) are registered as explicit no-ops.
        eventHandlers: {
          'elementalist.attunement': applyElementalistResolverAttunement,
          'elementalist.aura': applyElementalistResolverAura,
          'elementalist.fresh-air': () => {},
          'elementalist.evasive-arcana': () => {},
          'elementalist.attunement-enter': () => {},
          'elementalist.signet-fire': applyElementalistResolverSignetFire
        }
      }
    }
  },
  presentation: bindElementalistCoreUi
});
