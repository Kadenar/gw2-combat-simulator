import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

// Simple declarations retain concrete trait types and require explicit conversion policies.
export const attributeTrait = defineTrait<ElementalistSkill>({
  id: 1,
  name: 'Typed attributes',
  balance: { bonus: 20, conversion: 0.1 },
  buildAttributes: traitAttributeEffects(1, [
    { kind: 'flat', to: 'Power', field: 'bonus', feedsConversions: true },
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Ferocity',
      field: 'conversion',
      rounding: 'round',
      input: 'eligible'
    }
  ])
});

if (false) {
  traitAttributeEffects(1, [
    // @ts-expect-error Flat bonuses must declare whether they feed conversions.
    { kind: 'flat', to: 'Power', field: 'bonus' }
  ]);
  traitAttributeEffects(1, [
    // @ts-expect-error Conversions must declare their input pool.
    { kind: 'conversion', from: 'Power', to: 'Ferocity', field: 'conversion', rounding: 'round' }
  ]);
  traitAttributeEffects(1, [
    // @ts-expect-error Conversions must declare their rounding policy.
    { kind: 'conversion', from: 'Power', to: 'Ferocity', field: 'conversion', input: 'eligible' }
  ]);
  traitAttributeEffects(1, [
    {
      kind: 'flat',
      to: 'Power',
      field: 'bonus',
      feedsConversions: true,
      // @ts-expect-error Conditional contributions belong in explicit callbacks.
      enabled: false
    }
  ]);
  traitAttributeEffects(1, [
    {
      kind: 'flat',
      to: 'Power',
      field: 'bonus',
      feedsConversions: true,
      // @ts-expect-error Values come from the selected balance profile.
      amount: 20
    }
  ]);
}
