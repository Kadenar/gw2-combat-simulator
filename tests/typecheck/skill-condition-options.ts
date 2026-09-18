import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import type { EmitSkillConditionOptions } from '#gw2/platform/scheduler/skill-events.js';
import type { SchedulerContext } from '#gw2/platform/engine/execution/types.js';

// Condition authors use one options object; misspelled fields cannot bypass the declared contract.
export function checkConditionOptions(context: SchedulerContext): void {
  const options: EmitSkillConditionOptions = {
    skill: { id: 101, name: 'Skill' },
    at: 0,
    condition: 'Burning',
    stacks: 1,
    duration: 2,
    fixedDuration: true
  };
  emitSkillCondition(context, options);
  // @ts-expect-error Conditions no longer accept a second, positional skill identity.
  emitSkillCondition(context, options.skill, options);
  // @ts-expect-error Unknown top-level fields must not silently enter the event stream.
  emitSkillCondition(context, { ...options, arbitraryFlag: true });
  // @ts-expect-error Known condition controls retain their declared value types.
  emitSkillCondition(context, { ...options, fixedDuration: 'true' });
}
