import { defineNativeProfession } from '../../platform/gw2/native-profession.js';
import { activePatchPreview } from '../../patches/active-preview.js';
import { createNecromancerBuildDefaults, migrateNecromancerBuild, validateNecromancerBuild } from './build.js';
import './data/trait-coverage.js';
import { necromancerNativeModules } from './modules.js';
import type { Gw2SimulationResult } from '../../platform/gw2/types.js';
import type { NecromancerConfig, NecromancerResolverEvent } from './types.js';

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
  patchPreview: activePatchPreview,
  simulation: Object.freeze({
    refineSchedulerConfig: refineNecromancerSchedulerConfig
  })
});

export default necromancerProfession;
