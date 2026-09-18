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
  emitSkillCondition(context, {
    ...options,
    actorType: 'summon',
    summonKind: 'clone',
    summonOwner: 'mesmer.clone:1',
    metadata: { cloneId: 1, blade: false, triggeredByAlly: 0, venomProcEffectIndex: 0 }
  });
  // @ts-expect-error Migrated annotations belong to validated metadata, not shared controls.
  emitSkillCondition(context, { ...options, cloneId: 1 });
  // @ts-expect-error Blade annotations must be nested.
  emitSkillCondition(context, { ...options, blade: false });
  // @ts-expect-error Shatter annotations must be nested.
  emitSkillCondition(context, { ...options, shatter: true });
  // @ts-expect-error Shatter eligibility must be nested.
  emitSkillCondition(context, { ...options, shatterTraitEligible: false });
  // @ts-expect-error Instrument annotations must be nested.
  emitSkillCondition(context, { ...options, instrument: 'Flute' });
  // @ts-expect-error Ally annotations must be nested.
  emitSkillCondition(context, { ...options, triggeredByAlly: 1 });
  // @ts-expect-error Venom packet annotations must be nested.
  emitSkillCondition(context, { ...options, venomProcEffectIndex: 0 });
  // @ts-expect-error Metadata retains its closed vocabulary.
  emitSkillCondition(context, { ...options, metadata: { arbitraryFlag: true } });
  // @ts-expect-error Metadata annotations retain their primitive types.
  emitSkillCondition(context, { ...options, metadata: { cloneId: '1' } });
  // @ts-expect-error Ally identity remains numeric, not boolean.
  emitSkillCondition(context, { ...options, metadata: { triggeredByAlly: true } });
  // @ts-expect-error Conditions no longer accept a second, positional skill identity.
  emitSkillCondition(context, options.skill, options);
  // @ts-expect-error Unknown top-level fields must not silently enter the event stream.
  emitSkillCondition(context, { ...options, arbitraryFlag: true });
  // @ts-expect-error Known condition controls retain their declared value types.
  emitSkillCondition(context, { ...options, fixedDuration: 'true' });
}
