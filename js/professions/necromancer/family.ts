import { defineProfessionFamily } from "../../platform/engine/profession.js";
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
import { necromancerCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import {
  necromancerCastRules,
  necromancerSchedulerHooks,
} from "./mechanics/contract.js";
import {
  necromancerResolverEventHandlers,
  necromancerResolverEventReactions,
} from "./resolver.js";
import { harbingerModule } from "./specializations/harbinger/module.js";
import { reaperModule } from "./specializations/reaper/module.js";
import { ritualistModule } from "./specializations/ritualist/module.js";
import { scourgeModule } from "./specializations/scourge/module.js";
import {
  createNecromancerResolverState,
  createNecromancerState,
  projectNecromancerEndState,
  snapshotNecromancerState,
} from "./state.js";
import { createNecromancerFamilyUi } from "./ui.js";
import type { Gw2SimulationResult } from "../../platform/gw2/types.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type {
  NecromancerConfig,
  NecromancerResolverEvent,
  NecromancerSchedulerContext,
} from "./types.js";

function targetBelowHalfAt(
  result: Gw2SimulationResult,
  targetHealth: number,
): number | null {
  const damageByTime = new Map<number, number>();
  const addDamage = (at: number, damage: number): void => {
    const amount = Number(damage);
    if (!(amount > 0)) return;
    damageByTime.set(Number(at), (damageByTime.get(Number(at)) || 0) + amount);
  };
  const resolvedEvents = (
    result.resolvedEvents as readonly NecromancerResolverEvent[] | undefined
  ) || [];
  for (const event of resolvedEvents) {
    if (event.type === "damage") {
      addDamage(event.at, Number(event.damage || 0));
    } else if (Array.isArray(event.damageTicks)) {
      for (const tick of event.damageTicks) {
        addDamage(Number(tick.at), Number(tick.damage));
      }
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

function refineNecromancerSchedulerConfig(
  config: NecromancerConfig,
  result: Gw2SimulationResult,
): NecromancerConfig | null {
  const targetHealth = Number(config.target?.health || 0);
  if (!(targetHealth > 0)) return null;
  const belowHalfAt = targetBelowHalfAt(result, targetHealth);
  if (belowHalfAt == null) return null;
  const schedulerFeedback = config._schedulerFeedback as
    | { readonly targetBelowHalfAt?: number }
    | undefined;
  const previous = Number(schedulerFeedback?.targetBelowHalfAt);
  if (Number.isFinite(previous) && previous === belowHalfAt) return null;
  return {
    ...config,
    _schedulerFeedback: {
      ...(config._schedulerFeedback || {}),
      targetBelowHalfAt: belowHalfAt,
    },
  };
}

const necromancerUi = createNecromancerFamilyUi(
  necromancerCoreModule.ui || {},
  {
    Reaper: reaperModule.ui || {},
    Scourge: scourgeModule.ui || {},
    Harbinger: harbingerModule.ui || {},
    Ritualist: ritualistModule.ui || {},
  },
);

export const necromancerProfession =
  defineProfessionFamily<SchedulerRecord>({
    id: "necromancer",
    name: "Necromancer",
    catalog: necromancerCatalog,
    build: {
      createBuildDefaults: createNecromancerBuildDefaults,
      migrateBuild: migrateNecromancerBuild,
      validateBuild: validateNecromancerBuild,
    },
    // Family/application compatibility only. Simulation always uses the
    // module-composed state factory returned by resolveRuntime().
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
      snapshot: (context: NecromancerSchedulerContext) =>
        snapshotNecromancerState(context.state.profession),
    },
    resolverHooks: {
      eventHandlers: necromancerResolverEventHandlers,
      eventReactions: necromancerResolverEventReactions,
    },
    core: necromancerCoreModule,
    specializations: {
      Reaper: reaperModule,
      Scourge: scourgeModule,
      Harbinger: harbingerModule,
      Ritualist: ritualistModule,
    },
    simulation: Object.freeze({
      refineSchedulerConfig: refineNecromancerSchedulerConfig,
    }),
    ui: necromancerUi,
  });

export default necromancerProfession;
