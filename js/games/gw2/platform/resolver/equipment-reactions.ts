/** Equipment owners execute item rules at the resolver's ordered reaction stages. */
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { createCriticalFoodEffect, criticalFoodProc } from '#gw2/platform/equipment/consumables/food-procs.js';
import type { Gw2ConditionHelpers } from '#gw2/platform/equipment/relics/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverReactionContributions, Gw2ResolverStageDetails } from '#gw2/platform/resolver/types.js';

const GW2_REACTION_ORDER = Object.freeze({
  EARLY_COMMON: -200,
  COMMON: -100,
  LATE_COMMON: 100,
  FINAL_COMMON: 200
});

function conditionHelpers(
  context: Gw2ResolverRuntime,
  details: Gw2ResolverStageDetails['control.resolved']
): Gw2ConditionHelpers {
  const { activeConditionStackCount } = details;
  return {
    activeConditionStackCount: (_relicContext, condition, at) => activeConditionStackCount(context, condition, at)
  };
}

/**
 * Resolver stages preserve reaction order while equipment owners dispatch each observation. Optional relic hooks
 * let a stage skip deriving inputs for relics that ignore that observation.
 */
export function createGw2EquipmentReactionContributions(): Gw2ResolverReactionContributions {
  const criticalFoodReaction = criticalProcHandler<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'food.critical-strike',
    chanceOnCriticalHit: (ctx) => criticalFoodProc(ctx.config.food)?.chance || 0,
    actorTypes: [ACTOR.PLAYER],
    when: (ctx, event) =>
      isGw2PlayerActorEvent(event) && Number(event.coefficient) > 0 && criticalFoodProc(ctx.config.food) != null,
    internalCooldown: {
      duration: (ctx) => (criticalFoodProc(ctx.config.food)?.icdMs || 0) / 1000,
      // The critical-proc handler owns the sampled claim; equipment shares the registry's storage.
      key: 'food.critical-strike'
    },
    randomStream: 'food.critical-strike',
    handler: (ctx, event, _details, application) => {
      // Food procs are discrete events, so materialize every successful sampled application independently.
      const food = criticalFoodProc(ctx.config.food);

      if (!food) return;

      for (let index = 0; index < application.quantity; index++) createCriticalFoodEffect(ctx, event, food);
    }
  });

  return Object.freeze({
    'combo.resolved': [
      {
        id: 'relic.combo',
        order: GW2_REACTION_ORDER.COMMON,
        // All successful combos reach the relic runtime so Steamshrieker can accept leaps as well as blasts.
        handler(ctx, event) {
          ctx.relic.combo(ctx, event);
        }
      }
    ],
    'buff.applied': [
      {
        id: 'relic.boon',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event) {
          ctx.relic.boon(ctx, event);
        }
      }
    ],
    'damage.resolved': [
      {
        id: 'sigil.critical-strike',
        order: GW2_REACTION_ORDER.EARLY_COMMON,
        handler(ctx, event, details) {
          ctx.sigil.criticalHit(ctx, event, details.hitContext.critical);
        }
      },
      {
        id: 'relic.damage-resolved',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event) {
          ctx.relic.damageResolved(ctx, event);
        }
      },
      {
        id: 'food.critical-strike',
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler: criticalFoodReaction
      },
      {
        id: 'relic.after-hit',
        order: GW2_REACTION_ORDER.FINAL_COMMON,
        handler(ctx, event, details) {
          // Eligibility uses the resolved profile even when the authored packet inherited its weapon strength.
          const profile = details.hitContext.weaponStrength?.profileId;
          ctx.relic.afterHit?.(
            ctx,
            profile ? { ...event, weaponStrengthProfileId: profile } : event,
            skillForEvent(ctx.helpers, event)
          );
        }
      }
    ],
    'condition.applied': [
      {
        id: 'relic.fear',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, application, details) {
          // Disable-triggered relics also accept Fear, once its condition is present on the target.
          if (application.condition === CONDITION.FEAR)
            ctx.relic.control?.(ctx, application, conditionHelpers(ctx, details));
        }
      },
      {
        id: 'relic.condition',
        order: GW2_REACTION_ORDER.LATE_COMMON,
        handler(ctx, application, details) {
          // The stack index lets relic thresholds tell the first sibling from later ones.
          ctx.relic.condition?.(ctx, application, {
            ...conditionHelpers(ctx, details),
            conditionStackIndex: details.conditionStackIndex
          });
        }
      }
    ],
    'control.resolved': [
      {
        id: 'relic.control',
        order: GW2_REACTION_ORDER.COMMON,
        handler(ctx, event, details) {
          ctx.relic.control?.(ctx, event, conditionHelpers(ctx, details));
        }
      }
    ]
  });
}
