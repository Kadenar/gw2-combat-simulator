/** Resolve each Double Edge cast at acceptance so delayed effects and coin payouts use its own outcome. */
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefDoubleEdgeOutcome, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** The editor, outcome and recharge rules use the family. Readiness uses the paired recharge flag. */
export const DOUBLE_EDGE = { skillFamily: 'Double Edge', usableWhileRecharging: true } as const;
// Each cast keeps its outcome and any skill-authored payout until it commits or is cancelled.
const accepted = new WeakMap<RuntimeCast, { outcome: ThiefDoubleEdgeOutcome; initiativeGain: number }>();

/** Cannon selects its packets using the outcome of the cast that fired them. */
export function doubleEdgeBackfired(cast: RuntimeCast): boolean {
  return accepted.get(cast)?.outcome === 'backfire';
}

function recharging(
  runtime: Pick<MechanicQueriesOf<ThiefRuntime>, 'time' | 'cooldownController'>,
  skill: ThiefSkill
): boolean {
  return (runtime.cooldownController.readyAt(skill.id) ?? 0) > runtime.time;
}

/** Double Edge is risky only while its recharge is running; Scoundrel's Luck turns one risky use into a success. */
function acceptDoubleEdge(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): ThiefDoubleEdgeOutcome {
  if (!recharging(runtime, cast.skill)) return 'success';

  const state = antiquaryState.from(runtime.profession);

  if (state.scoundrelsLuck > 0) {
    state.scoundrelsLuck -= 1;
    return 'success';
  }

  return cast.command.doubleEdgeOutcome ?? 'success';
}

/** Fix the outcome and reserve any initiative at acceptance. Only commitment pays the reserved amount. */
export const doubleEdgeLifecycle: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  // A risky recast keeps the running timer whether it commits or is cancelled, so it adds no recharge work.
  rechargeWork(runtime, skill, work) {
    return skill.skillFamily === 'Double Edge' && recharging(runtime, skill) ? 0 : work;
  },
  onCastStart(runtime, cast) {
    if (cast.skill.skillFamily !== 'Double Edge') return;

    const outcome = acceptDoubleEdge(runtime, cast);
    const initiativeGain = cast.skill.doubleEdgeInitiative?.(runtime, outcome) ?? 0;
    accepted.set(cast, { outcome, initiativeGain });
  },
  onCastCommit(runtime, cast) {
    const result = accepted.get(cast);

    if (!result) return;

    accepted.delete(cast);

    if (result.initiativeGain > 0) runtime.resourceController.grant('initiative', result.initiativeGain);
  },
  onCastCancel(_runtime, cast) {
    accepted.delete(cast);
  }
};
