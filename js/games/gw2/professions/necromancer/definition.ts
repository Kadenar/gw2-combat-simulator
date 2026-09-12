import type { NecromancerSchedulerFeedback } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild,
  validateNecromancerBuild
} from '#gw2/professions/necromancer/build/build.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerNativeModules } from '#gw2/professions/necromancer/modules.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type { NecromancerConfig, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';
import { observeNecromancerAutoattackTransition } from '#gw2/professions/necromancer/core/mechanics/sword-chain.js';

/** Finds the first exact damage boundary where the target falls below half health. */
function targetBelowHalfAt(result: Gw2SimulationResult, config: NecromancerConfig): number | null {
  const targetHealth = Number(config.target?.health || 0);
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

  let damage = targetHealthLoss(config, null);
  if (damage > targetHealth * 0.5) return 0;
  for (const [at, amount] of [...damageByTime].sort((left, right) => left[0] - right[0])) {
    damage += amount;
    if (damage > targetHealth * 0.5) return at;
  }

  return null;
}

/** Replay live condition observations and timestamped resource gains alongside the Gravedigger health boundary. */
function refineNecromancerSchedulerConfig(
  config: NecromancerConfig,
  result: Gw2SimulationResult
): NecromancerConfig | null {
  const previous = (config._schedulerFeedback || {}) as NecromancerSchedulerFeedback;
  const hasGravediggerCast = result.events.some(
    (event) => event.type === 'action' && Number(event.skillId) === ID.GRAVEDIGGER
  );
  const conditionCounts: Record<string, number> = {};
  const lifeForceGains: { at: number; amount: number }[] = [];
  for (const event of result.resolvedEvents || []) {
    if (event.type === 'necromancer.target-condition-count') {
      conditionCounts[String(event.observationKey)] = Number(event.conditionCount);
    } else if (event.type === 'necromancer.life-force-gain') {
      lifeForceGains.push({ at: event.at, amount: Number(event.amount) });
    }
  }

  const targetBelowHalf =
    hasGravediggerCast && Number(config.target?.health) > 0 ? targetBelowHalfAt(result, config) : null;
  if (
    (previous.targetBelowHalfAt ?? null) === targetBelowHalf &&
    JSON.stringify(previous.conditionCounts || {}) === JSON.stringify(conditionCounts) &&
    JSON.stringify(previous.lifeForceGains || []) === JSON.stringify(lifeForceGains)
  )
    return null;
  return {
    ...config,
    _schedulerFeedback: {
      ...previous,
      targetBelowHalfAt: targetBelowHalf ?? undefined,
      conditionCounts,
      lifeForceGains
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
        // Entering or leaving shroud resets weapon-chain state even without a direct damage packet.
        id: 'necromancer.form-casts-reset',
        when: ({ interruptingSkill }) =>
          Boolean(interruptingSkill.shroud) || interruptingSkill.handlerId === 'necromancer.shroud',
        decision: 'reset'
      }
    ],
    onTransition: observeNecromancerAutoattackTransition
  },
  simulation: Object.freeze({
    refineSchedulerConfig: refineNecromancerSchedulerConfig
  })
});

export default necromancerProfession;
