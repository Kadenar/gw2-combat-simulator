/** Named work retains detached payloads and cast causality while the coordinator alone owns queue mutation. */
import type { ResourceDepletionWake } from '#gw2/platform/combat/resources/resource-controller.js';
import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { createExecutionCoordinator } from '#gw2/platform/simulation/coordinator.js';
import type { createInternalWorkFactory } from '#gw2/platform/simulation/internal-work.js';
import type { RuntimeWork, TaskScheduling, WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

type ScheduledTaskWork = Extract<RuntimeWork, { type: 'runtime.task' | 'runtime.cast-task' }>;
interface RuntimeTaskScheduler<TSkill extends Skill = Skill> {
  readonly commands: TaskScheduling<TSkill>;
  dispatch(work: ScheduledTaskWork): void;
}
interface RuntimeTaskSchedulerOptions<T extends object, TSkill extends Skill> {
  readonly tasks: RuntimeProfession<T, TSkill>['tasks'];
  readonly skillsById: ReadonlyMap<SkillId, TSkill>;
  readonly context: () => MechanicContext<T, TSkill>;
  readonly makeWork: ReturnType<typeof createInternalWorkFactory<RuntimeWork>>;
  readonly enqueueWork: (work: RuntimeWork) => void;
  readonly cancelOwned: (owner: WorkOwner) => void;
  readonly castAction: (castId: string) => Gw2ResolverEvent | undefined;
  readonly withCause: ReturnType<typeof createExecutionCoordinator<T>>['withCause'];
}

export function createRuntimeTaskScheduler<T extends object, TSkill extends Skill>({
  tasks,
  skillsById,
  context,
  makeWork,
  enqueueWork,
  cancelOwned,
  castAction,
  withCause
}: RuntimeTaskSchedulerOptions<T, TSkill>): RuntimeTaskScheduler<TSkill> {
  const commands = Object.freeze({
    schedule(name, at, data = null, owner, priority = 0, timing) {
      if (!tasks?.[name]) throw new TypeError(`No task handler registered for ${name}.`);

      enqueueWork(makeWork({ type: 'runtime.task', at, priority, payload: { name, data }, owner, timing }));
    },
    scheduleForCast(name, at, cast, data = {}, owner, priority = 0, timing) {
      if (!tasks?.[name]) throw new TypeError(`No task handler registered for ${name}.`);

      // Executable skill declarations stay on the catalog side of the work factory's clone boundary.
      const { skill, ...reservation } = cast;

      if (!skillsById.has(skill.id)) throw new TypeError(`Unknown cast task skill ${skill.id}.`);

      enqueueWork(
        makeWork({
          type: 'runtime.cast-task',
          at,
          priority,
          timing,
          payload: { name, cast: reservation, skillId: skill.id, data },
          owner
        })
      );
    },
    cancelOwner: cancelOwned
  } satisfies TaskScheduling<TSkill>);
  return Object.freeze({
    commands,
    dispatch(work: ScheduledTaskWork) {
      if (work.type === 'runtime.task') {
        tasks![work.payload.name](context(), work.payload.data);
        return;
      }

      const { name, cast, skillId, data } = work.payload;
      // The real cast wins over authored data, and nested scopes restore their caller even on failure.
      withCause(
        castAction(cast.id) ?? null,
        () =>
          tasks![name](context(), {
            ...data,
            cast: { ...cast, skill: skillsById.get(skillId)! }
          }),
        true
      );
    }
  });
}

/** Scheduler generations replace depletion wakes without moving unchanged retained deadlines in insertion order. */
export function createResourceDepletionWake(
  scheduling: Pick<TaskScheduling, 'schedule' | 'cancelOwner'>
): ResourceDepletionWake {
  const wakes = new Map<ResourceKey, { at: number; generation: number }>();
  return Object.freeze({
    synchronize({ key, task, at, priority, retainUnchangedDeadline }) {
      const previous = wakes.get(key);

      if (retainUnchangedDeadline && previous?.at === at) return;

      const id = `resource-depletion:${key}`;

      if (previous) scheduling.cancelOwner({ id, generation: previous.generation });

      const generation = (previous?.generation ?? 0) + 1;
      wakes.set(key, { at, generation });

      if (Number.isFinite(at)) scheduling.schedule(task, at, null, { id, generation }, priority);
    }
  } satisfies ResourceDepletionWake);
}
