import { createRotationDriver } from '#gw2/platform/execution/rotation-driver.js';
import { spendSkillCost } from '#gw2/platform/execution/skill-cost.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import {
  applyRuntimeSigils,
  applyRuntimeSigilStrike,
  type SigilRuntimeContext
} from '#gw2/platform/equipment/sigils/runtime.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/execution.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

/** Full combat registers gameplay producers and costs alongside the authored rotation driver. */
export function createCombatExecution<T extends object>(
  profession: RuntimeProfession<T>,
  rotation: readonly unknown[]
): RuntimeExecution<T> {
  let sigils: SigilRuntimeContext;
  return {
    driver: createRotationDriver(profession, rotation),
    acceptsEffect: () => true,
    professionReactions: profession.reactions,
    spendCost: (runtime, skill) => spendSkillCost(runtime.mechanics, skill),
    combatStart: (runtime) => profession.onCombatStart?.(runtime.mechanics),
    contributions(getRuntime) {
      // Bind once per execution; equipment cannot traverse commands or reach profession/report stores.
      sigils = Object.freeze({
        get config() {
          return getRuntime().config;
        },
        get effects() {
          return getRuntime().effects;
        },
        get combatStartTime() {
          return getRuntime().combatStartTime;
        },
        get combatStartPending() {
          return getRuntime().combatStartPending;
        },
        get combatActive() {
          return getRuntime().combatActive;
        },
        get activeWeaponSet() {
          return getRuntime().activeWeaponSet;
        },
        get firstHitTime() {
          return getRuntime().firstHitTime;
        },
        get sigil() {
          return getRuntime().sigil;
        },
        procs: Object.freeze({
          claimCooldown: (key: string | number, at: number, duration: number) =>
            getRuntime().procs.claimCooldown(key, at, duration)
        }),
        endurance: Object.freeze({ grant: (amount: number) => getRuntime().endurance.grant(amount) })
      });
      const equipment = createGw2EquipmentReactionContributions();
      return {
        ...equipment,
        'damage.resolved': [
          ...(equipment['damage.resolved'] ?? []),
          {
            id: 'sigil.actual-strike',
            order: -300,
            handler: (_context, event) => applyRuntimeSigilStrike(sigils, event)
          }
        ],
        'control.resolved': [
          ...(equipment['control.resolved'] ?? []),
          {
            id: 'sigil.actual-control',
            order: -300,
            handler: (_context, event) => applyRuntimeSigils(sigils, 'control', event)
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
    weaponSwap: (_runtime, event) => applyRuntimeSigils(sigils, 'swap', event),
    report: (runtime, combatEndTime) => invokeRelicHook(runtime, 'passiveTimeline', combatEndTime)
  };
}
