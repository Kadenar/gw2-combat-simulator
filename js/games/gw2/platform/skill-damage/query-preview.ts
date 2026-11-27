/** Calculate generic player facts after occurrence preparation, without exposing the live runtime to callers. */
import { ATTRIBUTE_KEYS, CONDITION_DURATION_KEYS } from '#gw2/platform/attributes/inputs.js';
import type { Gw2ResolvedStats } from '#gw2/platform/attributes/stats.js';
import { gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { gw2SigilSet } from '#gw2/platform/equipment/sigils/loadout.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { runRuntime } from '#gw2/platform/simulation/runtime.js';
import { createDamageExecution } from '#gw2/platform/skill-damage/occurrence-driver.js';
import type { DamageInputs } from '#gw2/platform/skill-damage/types.js';

/** Detached calculation facts retain native units; application presentation owns labels and percentages. */
export interface DamagePreviewFacts {
  readonly stats: Pick<Gw2ResolvedStats, (typeof ATTRIBUTE_KEYS)[keyof typeof ATTRIBUTE_KEYS]>;
  readonly criticalChanceBeforeCap: number;
  readonly criticalDamageMultiplier: number;
  readonly boonDurationMultiplier: number;
  readonly conditionDurationMultiplier: number;
  readonly conditionDurationMultipliers: Readonly<
    Record<(typeof CONDITION_DURATION_KEYS)[keyof typeof CONDITION_DURATION_KEYS], number>
  >;
  readonly strikeMultiplier: number;
  readonly conditionMultiplier: number;
}

/** Use the same initialization and assumption settlement as measured occurrences, without a skill override. */
export function queryDamagePreview(
  source: Gw2ProfessionSource,
  config: Gw2Config,
  inputs: DamageInputs
): DamagePreviewFacts {
  const isolatedConfig = structuredClone(config);
  const profession = source.runtimeFor(isolatedConfig, { traitTriggers: false });
  let value: DamagePreviewFacts;
  runRuntime({
    profession,
    config: isolatedConfig,
    output: 'damage',
    ownsEffect: () => false,
    execution: createDamageExecution(profession, {
      inputs,
      accepts: (event) => String(event.sourceId).startsWith('assumption.'),
      emit(runtime) {
        const at = runtime.time;
        const event: SimulationEvent = {
          type: 'action',
          at,
          actorType: ACTOR.PLAYER,
          source: 'Player',
          sourceId: 'stat-preview'
        };
        const query = runtime.query;
        const stats = query.statsAt(at, event, runtime);
        const critical = query.critical(event, at, runtime, stats);
        const duration = (name: string) => query.conditionDurationMultiplier(name, at, stats, event, runtime);
        value = {
          stats: Object.fromEntries(
            Object.values(ATTRIBUTE_KEYS).map((key) => [key, stats[key]])
          ) as DamagePreviewFacts['stats'],
          criticalChanceBeforeCap: critical.chanceBeforeCap ?? critical.chance,
          criticalDamageMultiplier: critical.damage,
          boonDurationMultiplier: gw2BoonDurationMultiplier(
            null,
            stats,
            gw2SigilSet(runtime.config, runtime.activeWeaponSet)
          ),
          conditionDurationMultiplier: duration(''),
          conditionDurationMultipliers: Object.fromEntries(
            Object.values(CONDITION_DURATION_KEYS).map((condition) => [condition, duration(condition)])
          ) as DamagePreviewFacts['conditionDurationMultipliers'],
          strikeMultiplier: query.strikeMultiplier(event, at, runtime),
          conditionMultiplier: query.conditionMultiplier('', at, event, runtime)
        };
      }
    })
  });
  return value!;
}
