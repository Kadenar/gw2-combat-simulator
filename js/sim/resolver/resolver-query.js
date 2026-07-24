import { createCombatStats } from "./combat-stats.js";
import { createDamageModifiers } from "./damage-modifiers.js";
import { createTimelineIndex } from "./timeline-index.js";

/**
 * Composes the read-only queries consumed by timeline resolution.
 */
export function buildResolverQuery(config, traits, events, model) {
  const timeline = createTimelineIndex({
    config,
    events,
    clamp: model.clamp,
    qualifyingIcdEvents: model.qualifyingIcdEvents,
    sigilSet: model.sigilSet,
  });
  const combatStats = createCombatStats({
    config,
    traits,
    timeline,
    clamp: model.clamp,
    staticAttributes: model.staticAttributes,
    thornsStacksAt: model.thornsStacksAt,
    thornsConditionDamage: model.THORNS_CONDITION_DAMAGE,
  });
  const damageModifiers = createDamageModifiers({
    config,
    traits,
    timeline,
    statsAt: combatStats.statsAt,
    durationMultiplier: model.durationMultiplier,
  });

  return {
    ...combatStats,
    ...damageModifiers,
    activeWeaponSetAt: timeline.activeWeaponSetAt,
    timedStacks: timeline.timedStacks,
    instrumentsAt: timeline.instrumentsAt,
  };
}
