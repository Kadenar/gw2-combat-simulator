// Condition authors use one options object; misspelled fields cannot bypass the declared contract.
import type { ConditionEventFields, EffectMetadata } from '#gw2/platform/engine/events/events.js';
function condition(fields: ConditionEventFields & { metadata?: EffectMetadata }) {
  return fields;
}

export function checkConditionOptions(): void {
  const options: ConditionEventFields = {
    at: 0,
    condition: 'Burning',
    stacks: 1,
    duration: 2,
    fixedDuration: true
  };
  condition(options);
  condition({
    ...options,
    summonOwner: 'mesmer.clone:1',
    metadata: { cloneId: 1, blade: false, triggeredByAlly: 0, venomProcEffectIndex: 0 }
  });
  // @ts-expect-error Migrated annotations belong to validated metadata, not shared controls.
  condition({ ...options, cloneId: 1 });
  // @ts-expect-error Blade annotations must be nested.
  condition({ ...options, blade: false });
  // @ts-expect-error Shatter annotations must be nested.
  condition({ ...options, shatter: true });
  // @ts-expect-error Shatter eligibility must be nested.
  condition({ ...options, shatterTraitEligible: false });
  // @ts-expect-error Instrument annotations must be nested.
  condition({ ...options, instrument: 'Flute' });
  // @ts-expect-error Ally annotations must be nested.
  condition({ ...options, triggeredByAlly: 1 });
  // @ts-expect-error Venom packet annotations must be nested.
  condition({ ...options, venomProcEffectIndex: 0 });
  // @ts-expect-error Metadata retains its closed vocabulary.
  condition({ ...options, metadata: { arbitraryFlag: true } });
  // @ts-expect-error Metadata annotations retain their primitive types.
  condition({ ...options, metadata: { cloneId: '1' } });
  // @ts-expect-error Ally identity remains numeric, not boolean.
  condition({ ...options, metadata: { triggeredByAlly: true } });
  // @ts-expect-error Conditions no longer accept a second, positional skill identity.
  condition(options, options);
  // @ts-expect-error Unknown top-level fields must not silently enter the event stream.
  condition({ ...options, arbitraryFlag: true });
  // @ts-expect-error Known condition controls retain their declared value types.
  condition({ ...options, fixedDuration: 'true' });
}
