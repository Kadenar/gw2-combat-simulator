import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { createRotationDriver } from '#gw2/platform/execution/rotation-driver.js';
import { spendSkillCost } from '#gw2/platform/execution/skill-cost.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/run-contract.js';

/** Full combat registers gameplay producers and costs alongside the authored rotation driver. */
export function createCombatExecution<T extends object>(
  profession: RuntimeProfession<T>,
  rotation: readonly unknown[]
): RuntimeExecution<T> {
  return {
    driver: createRotationDriver(profession, rotation),
    acceptsEffect: () => true,
    professionReactions: profession.reactions,
    spendCost: (runtime, skill) => spendSkillCost(runtime.mechanics, skill),
    combatStart(runtime) {
      runtime.alliedStrikeController.start();
      profession.onCombatStart?.(runtime.mechanics);
    },
    bindProducers(getRuntime) {
      const equipment = createGw2EquipmentReactionContributions();
      // Handlers read the current runtime for each observation so replacement owners remain visible.
      return {
        weaponSwap(event) {
          const runtime = getRuntime();
          runtime.sigil.swap(runtime, event);
        },
        contributions: {
          ...equipment,
          'condition.applied': [
            ...(equipment['condition.applied'] ?? []),
            {
              id: 'sigil.actual-fear',
              order: -300,
              handler: (_context, event) => {
                // Fear qualifies for disable procs through its accepted condition application.
                if (event.condition === CONDITION.FEAR) {
                  const runtime = getRuntime();
                  runtime.sigil.control(runtime, event);
                }
              }
            }
          ],
          'damage.resolved': [
            ...(equipment['damage.resolved'] ?? []),
            {
              id: 'sigil.actual-strike',
              order: -300,
              handler(_context, event) {
                const runtime = getRuntime();
                runtime.sigil.strike(runtime, event);
              }
            }
          ],
          'control.resolved': [
            ...(equipment['control.resolved'] ?? []),
            {
              id: 'sigil.actual-control',
              order: -300,
              handler(_context, event) {
                const runtime = getRuntime();
                runtime.sigil.control(runtime, event);
              }
            }
          ]
        }
      };
    },
    // Dispatch at the existing execution stages; the relic owner selects the participating instances.
    castCompleted(runtime, event) {
      runtime.relic.completed(runtime, event);
    },
    action(runtime, event) {
      runtime.relic.action?.(runtime, event, skillForEvent(profession.catalog, event));
    },
    condition(runtime, event) {
      runtime.relic.emitConditionEffects(runtime, event);
    },
    report: (runtime, combatEndTime) => runtime.relic.passiveTimeline(runtime, combatEndTime)
  };
}
