/** Own upkeep activation and recurring work so Core and elite effects retire with the same activation. */
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  activateRevenantUpkeep,
  activeRevenantUpkeep,
  cancelRevenantUpkeep,
  releaseRevenantUpkeep,
  reserveRevenantUpkeep,
  REVENANT_ENERGY_DEPLETED,
  revenantUpkeepOwner,
  starveRevenantUpkeeps,
  upkeepRelease
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { embracePulse } from '#gw2/professions/revenant/core/skills/legends/demon.js';
import { hammerPulse } from '#gw2/professions/revenant/core/skills/legends/dwarf.js';
import type { RevenantUpkeepState } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { isRevenantUpkeep } from '#gw2/professions/revenant/data/upkeep-skills.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface UpkeepWork {
  readonly skillId: SkillId;
  readonly startsAt: number;
}

/** Owners supply effects and cadence policy; the upkeep lifecycle owns scheduling and retirement. */
interface RevenantUpkeepCadence {
  readonly name: string;
  readonly accepts: (skill: RevenantSkill) => boolean;
  readonly interval: number | ((skill: RevenantSkill) => number);
  readonly firstAt?: (runtime: RevenantRuntime, skill: RevenantSkill) => number | undefined;
  readonly priority?: number;
  readonly background?: boolean;
  readonly pulse: (runtime: RevenantRuntime, skill: RevenantSkill, active: RevenantUpkeepState) => void;
}

function cadenceInterval(cadence: RevenantUpkeepCadence, skill: RevenantSkill): number {
  return typeof cadence.interval === 'number' ? cadence.interval : cadence.interval(skill);
}

/** Every successor retains the activation owner so retiring upkeep cancels all its pending work. */
function schedulePulse(runtime: RevenantRuntime, cadence: RevenantUpkeepCadence, work: UpkeepWork, at: number): void {
  runtime.schedule(
    cadence.name,
    canonicalTime(at),
    work,
    revenantUpkeepOwner(work.skillId, work.startsAt),
    cadence.priority
  );
}

function startCadences(
  runtime: RevenantRuntime,
  skill: RevenantSkill,
  cadences: readonly RevenantUpkeepCadence[]
): void {
  const active = activeRevenantUpkeep(runtime, skill.id, runtime.time);

  if (!active) return;

  for (const cadence of cadences) {
    if (!cadence.accepts(skill)) continue;

    schedulePulse(
      runtime,
      cadence,
      { skillId: skill.id, startsAt: active.startsAt },
      cadence.firstAt?.(runtime, skill) ?? runtime.time + cadenceInterval(cadence, skill)
    );
  }
}

/** Dispatch resolves the live skill and checks the activation before effects and before scheduling its successor. */
function cadenceTasks(
  cadences: readonly RevenantUpkeepCadence[]
): NonNullable<RuntimeHooks<RevenantRuntimeState, RevenantSkill>['tasks']> {
  return Object.fromEntries(
    cadences.map((cadence) => [
      cadence.name,
      (runtime: RevenantRuntime, data: unknown) => {
        const work = data as UpkeepWork;
        const active = activeRevenantUpkeep(runtime, work.skillId, work.startsAt);
        const skill = runtime.helpers.skillsById.get(work.skillId);

        if (!active || !skill) return;

        cadence.pulse(runtime, skill, active);

        if (activeRevenantUpkeep(runtime, work.skillId, work.startsAt) === active)
          schedulePulse(runtime, cadence, work, runtime.time + cadenceInterval(cadence, skill));
      }
    ])
  );
}

/** Each contribution starts its own cadences at its position in the cast-commit hook order. */
export function createRevenantUpkeepContribution(
  cadences: readonly RevenantUpkeepCadence[]
): RuntimeHooks<RevenantRuntimeState, RevenantSkill> {
  return {
    onCastCommit(runtime, cast) {
      if (isRevenantUpkeep(cast.skill)) startCadences(runtime, cast.skill, cadences);
    },
    // Observation classifies task names, so resource and damaging cadences keep distinct task identities.
    backgroundTasks: cadences.filter((cadence) => cadence.background).map((cadence) => cadence.name),
    tasks: cadenceTasks(cadences)
  };
}

const coreCadences: readonly RevenantUpkeepCadence[] = [
  {
    name: 'revenant.upkeep-pulse',
    accepts: (skill) => skill.id === ID.EMBRACE_THE_DARKNESS || skill.id === ID.VENGEFUL_HAMMERS,
    interval: (skill) => Math.max(0, skill.pulseInterval ?? 1),
    firstAt: (runtime, skill) =>
      skill.id === ID.EMBRACE_THE_DARKNESS ? Math.floor(canonicalTime(runtime.time)) + 1 : undefined,
    pulse(runtime, skill, active) {
      if (skill.id === ID.EMBRACE_THE_DARKNESS) {
        embracePulse(runtime, skill, runtime.time, active.empoweredNextPulse);
        active.empoweredNextPulse = false;
      } else hammerPulse(runtime, skill, runtime.time);
    }
  }
];

/** Core starts its pulses at activation; elite contributions start at their own completion position. */
export const revenantUpkeepLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  prepareDamageState(runtime, _skill, inputs) {
    const upkeepId = JSON.parse(String(inputs.upkeep ?? 'null'));
    const upkeep = runtime.helpers.skills.find((entry) => entry.id === upkeepId && entry.upkeepCost != null);

    if (upkeep)
      runtime.profession.core.activeUpkeeps = [
        { skillId: upkeep.id, upkeepCost: Number(upkeep.upkeepCost), startsAt: runtime.time, empoweredNextPulse: false }
      ];
  },
  sideEffectHandlers: {
    'revenant.reserve-upkeep'(runtime, context) {
      if (context.kind === 'cast') reserveRevenantUpkeep(runtime, context.cast);
    },
    'revenant.activate-upkeep'(runtime, context) {
      if (context.kind !== 'cast') return;

      activateRevenantUpkeep(runtime, context.cast);
      startCadences(runtime, context.cast.skill, coreCadences);
    },
    'revenant.release-upkeep'(runtime, context) {
      if (context.kind === 'cast') releaseRevenantUpkeep(runtime, context.cast);
    }
  },
  modifyEffects(runtime, cast, effects) {
    return isRevenantUpkeep(cast.skill) || upkeepRelease(runtime, cast.skill) ? [] : effects;
  },
  onCastCancel: cancelRevenantUpkeep,
  tasks: {
    [REVENANT_ENERGY_DEPLETED]: starveRevenantUpkeeps,
    ...cadenceTasks(coreCadences)
  }
};
