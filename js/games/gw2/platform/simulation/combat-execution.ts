import { createRotationDriver } from '#gw2/platform/execution/rotation-driver.js';
import { spendSkillCost } from '#gw2/platform/execution/skill-cost.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import { applyRuntimeSigils, applyRuntimeSigilStrike } from '#gw2/platform/equipment/sigils/runtime.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/execution.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

/** Full combat registers gameplay producers and costs alongside the authored rotation driver. */
export function createCombatExecution<T extends object>(
  profession: RuntimeProfession<T>,
  rotation: readonly unknown[]
): RuntimeExecution<T> {
  return {
    driver: createRotationDriver(profession, rotation),
    acceptsEffect: () => true,
    professionReactions: profession.reactions,
    spendCost: spendSkillCost,
    combatStart: profession.onCombatStart,
    contributions(getRuntime) {
      const equipment = createGw2EquipmentReactionContributions();
      return {
        ...equipment,
        'damage.resolved': [
          ...(equipment['damage.resolved'] ?? []),
          {
            id: 'sigil.actual-strike',
            order: -300,
            handler: (_context, event) => applyRuntimeSigilStrike(getRuntime(), event)
          }
        ],
        'control.resolved': [
          ...(equipment['control.resolved'] ?? []),
          {
            id: 'sigil.actual-control',
            order: -300,
            handler: (_context, event) => applyRuntimeSigils(getRuntime(), 'control', event)
          }
        ]
      };
    },
    castCompleted(runtime, event) {
      for (const relic of [runtime.relic, ...(runtime.precastRelics ?? [])])
        relic.rules.completed?.(runtime, relic.state, event);
    },
    action(runtime, event) {
      if (!event.cancelled)
        invokeRelicHook(
          runtime,
          'emitActionEffects',
          event,
          profession.catalog.skillsById.get(event.skillId ?? event.sourceId)
        );
      invokeRelicHook(runtime, 'action', event);
    },
    condition(runtime, event) {
      if (runtime.relic.id === RELIC_IDS.SHACKLES) invokeRelicHook(runtime, 'emitConditionEffects', event);
    },
    weaponSwap: (runtime, event) => applyRuntimeSigils(runtime, 'swap', event),
    report: (runtime, combatEndTime) => invokeRelicHook(runtime, 'passiveTimeline', combatEndTime)
  };
}
