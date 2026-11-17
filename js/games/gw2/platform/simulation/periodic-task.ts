/** Bind periodic lifecycles to GW2 task hooks and preview completion policy. */
import {
  createPeriodicTask,
  type PeriodicTaskContext,
  type PeriodicTaskDefinition
} from '#kernel/execution/periodic-task.js';

/** Keep background classification in GW2 while the kernel owns cancellation, delivery, and rearming. */
export function definePeriodicTask<TContext extends PeriodicTaskContext>(
  definition: PeriodicTaskDefinition<TContext> & {
    /** Background loops never extend isolated previews; other loops retain their causal completion ownership. */
    readonly background: boolean;
  }
) {
  const { background, ...task } = definition;
  const { restart, stop, deliver } = createPeriodicTask(task);
  return {
    restart,
    stop,
    hooks: { backgroundTasks: background ? [task.name] : [], tasks: { [task.name]: deliver } }
  };
}
