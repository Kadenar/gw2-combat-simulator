import { defineNativeProfession } from '../../platform/gw2/authoring/profession.js';
import { activePatchPreview } from '../../patches/active-preview.js';
import { createNecromancerBuildDefaults, migrateNecromancerBuild, validateNecromancerBuild } from './build.js';
import { NECROMANCER_SKILL_IDS as ID } from './data/ids.js';
import { necromancerNativeModules } from './modules.js';
import type { Gw2SimulationResult } from '../../platform/gw2/simulation/types.js';
import type { NecromancerConfig, NecromancerResolverEvent } from './types.js';
import { observeNecromancerAutoattackTransition } from './core/contract.js';

// Merge direct hits and condition ticks by timestamp to find the first exact
// scheduling boundary where cumulative damage moves the target below half health.
function targetBelowHalfAt(result: Gw2SimulationResult, targetHealth: number): number | null {
  const damageByTime = new Map<number, number>();
  const addDamage = (at: number, damage: number): void => {
    const amount = Number(damage);

    if (!(amount > 0)) return;
    damageByTime.set(Number(at), (damageByTime.get(Number(at)) || 0) + amount);
  };

  const resolvedEvents = (result.resolvedEvents as readonly NecromancerResolverEvent[] | undefined) || [];
  for (const event of resolvedEvents) {
    if (event.type === 'damage') {
      addDamage(event.at, Number(event.damage || 0));
    } else if (Array.isArray(event.damageTicks)) {
      for (const tick of event.damageTicks) {
        addDamage(Number(tick.at), Number(tick.damage));
      }
    }
  }

  // Scheduler feedback uses the same combined target-health timeline as the
  // resolver while keeping environment damage out of player result totals.
  for (const condition of result.environmentConditionBreakdown || []) {
    for (const tick of condition.damageTicks) {
      addDamage(Number(tick.at), Number(tick.damage));
    }
  }

  let damage = 0;
  for (const [at, amount] of [...damageByTime].sort((left, right) => left[0] - right[0])) {
    damage += amount;

    if (damage > targetHealth * 0.5) return at;
  }

  return null;
}

function refineNecromancerSchedulerConfig(
  config: NecromancerConfig,
  result: Gw2SimulationResult
): NecromancerConfig | null {
  const targetHealth = Number(config.target?.health || 0);

  if (!(targetHealth > 0)) return null;
  // Only Gravedigger changes future scheduling at the 50% threshold; other health-based effects resolve in one pass.
  const hasGravediggerCast = result.events.some(
    (event) => event.type === 'action' && Number(event.skillId) === ID.GRAVEDIGGER
  );

  if (!hasGravediggerCast) return null;
  const belowHalfAt = targetBelowHalfAt(result, targetHealth);

  if (belowHalfAt == null) return null;
  const schedulerFeedback = config._schedulerFeedback as { readonly targetBelowHalfAt?: number } | undefined;
  const previous = Number(schedulerFeedback?.targetBelowHalfAt);

  if (Number.isFinite(previous) && previous === belowHalfAt) return null;
  return {
    ...config,
    _schedulerFeedback: {
      ...(config._schedulerFeedback || {}),
      targetBelowHalfAt: belowHalfAt
    }
  };
}

export const necromancerProfession = defineNativeProfession({
  id: 'necromancer',
  name: 'Necromancer',
  build: {
    createBuildDefaults: createNecromancerBuildDefaults,
    migrateBuild: migrateNecromancerBuild,
    validateBuild: validateNecromancerBuild
  },
  modules: necromancerNativeModules,
  autoattackChains: {
    overrides: [
      {
        // Sword retains its pending projectile step across other weapon casts only.
        id: 'necromancer.weapon-skills-preserve-sword',
        chainRootIds: [ID.ENERVATION_BLADE],
        when: ({ interruptingSkill }) => interruptingSkill.type === 'Weapon',
        decision: 'preserve'
      },
      {
        id: 'necromancer.timed-and-form-casts-reset',
        when: ({ interruptingSkill }) =>
          Number(interruptingSkill.castTimeMs || 0) > 0 ||
          Boolean(interruptingSkill.shroud) ||
          interruptingSkill.handlerId === 'necromancer.shroud',
        decision: 'reset'
      }
    ],
    onTransition: observeNecromancerAutoattackTransition
  },
  patchPreview: activePatchPreview,
  simulation: Object.freeze({
    refineSchedulerConfig: refineNecromancerSchedulerConfig
  })
});

export default necromancerProfession;
