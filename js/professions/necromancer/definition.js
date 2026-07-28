import { defineProfession } from "../../platform/engine/profession.js";
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild,
  validateNecromancerBuild,
} from "./build.js";
import {
  necromancerAttributeRules,
  necromancerCastModifiers,
} from "./attribute-rules.js";
import { necromancerCatalog } from "./catalog.js";
import {
  necromancerCastRules,
  necromancerSchedulerHooks,
} from "./mechanics/contract.js";
import {
  necromancerResolverEventHandlers,
  necromancerResolverEventReactions,
} from "./resolver/event-handlers.js";
import {
  createNecromancerResolverState,
  createNecromancerState,
  projectNecromancerEndState,
  snapshotNecromancerState,
} from "./state.js";
import { necromancerUi } from "./ui.js";

function targetBelowHalfAt(result, targetHealth) {
  const damageByTime = new Map();
  const addDamage = (at, damage) => {
    const amount = Number(damage);
    if (!(amount > 0)) return;
    damageByTime.set(Number(at), (damageByTime.get(Number(at)) || 0) + amount);
  };
  for (const event of result.resolvedEvents || []) {
    if (event.type === "damage") {
      addDamage(event.at, event.damage);
    } else if (Array.isArray(event.damageTicks)) {
      for (const tick of event.damageTicks) addDamage(tick.at, tick.damage);
    }
  }
  let damage = 0;
  for (const [at, amount] of [...damageByTime].sort(
    (left, right) => left[0] - right[0],
  )) {
    damage += amount;
    if (damage > targetHealth * 0.5) return at;
  }
  return null;
}

function refineNecromancerSchedulerConfig(config, result) {
  const targetHealth = Number(config.target?.health || 0);
  if (!(targetHealth > 0)) return null;
  const belowHalfAt = targetBelowHalfAt(result, targetHealth);
  if (belowHalfAt == null) return null;
  const previous = Number(
    config._schedulerFeedback?.targetBelowHalfAt,
  );
  if (Number.isFinite(previous) && previous === belowHalfAt) return null;
  return {
    ...config,
    _schedulerFeedback: {
      ...(config._schedulerFeedback || {}),
      targetBelowHalfAt: belowHalfAt,
    },
  };
}

export const necromancerProfession = defineProfession({
  id: "necromancer",
  name: "Necromancer",
  catalog: necromancerCatalog,
  build: {
    createBuildDefaults: createNecromancerBuildDefaults,
    migrateBuild: migrateNecromancerBuild,
    validateBuild: validateNecromancerBuild,
  },
  resources: {
    createProfessionState: createNecromancerState,
    createResolverState: createNecromancerResolverState,
    projectEndState: projectNecromancerEndState,
  },
  attributeRules: necromancerAttributeRules,
  castRules: {
    ...necromancerCastRules,
    ...necromancerCastModifiers,
  },
  schedulerHooks: {
    ...necromancerSchedulerHooks,
    snapshot: (context) => snapshotNecromancerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: necromancerResolverEventHandlers,
    eventReactions: necromancerResolverEventReactions,
  },
  simulation: Object.freeze({
    refineSchedulerConfig: refineNecromancerSchedulerConfig,
  }),
  ui: necromancerUi,
});

export default necromancerProfession;
