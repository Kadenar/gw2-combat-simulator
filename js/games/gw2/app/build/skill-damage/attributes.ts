/** Calculates the skill-damage stat strip from the same full-health runtime used by its measurements. */
import { createSkillDamagePreview } from '#gw2/app/build/skill-damage/preview.js';
import type { AttributePreviewInput } from '#gw2/app/build/types.js';
import { derivedAttribute } from '#gw2/platform/attributes/calculation.js';
import { ATTRIBUTE_KEYS, CONDITION_DURATION_KEYS } from '#gw2/platform/attributes/inputs.js';
import type { PreviewControl } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { queryDamagePreview } from '#gw2/platform/skill-damage/query-preview.js';

/** Present detached full-health calculation facts using the build's existing attribute breakdowns. */
export function calculateSkillDamageAttributes(
  input: AttributePreviewInput,
  rawValues: Readonly<Record<string, unknown>>,
  controls: readonly PreviewControl[]
) {
  const { preview, config, inputs } = createSkillDamagePreview(input, controls, rawValues);
  const attributes = structuredClone(preview.attributeData!.attributes);
  const facts = queryDamagePreview(input.profession, config, inputs);
  const { stats } = facts;
  const set = (name: string, final: number): void => {
    const original = attributes[name] || derivedAttribute(0);
    attributes[name] = Object.assign({}, original, { final, conditional: final - original.final });
  };

  for (const [name, key] of Object.entries(ATTRIBUTE_KEYS)) set(name, stats[key]);
  set('Critical Chance', facts.criticalChanceBeforeCap * 100);
  set('Critical Damage', facts.criticalDamageMultiplier * 100);
  set('Boon Duration', (facts.boonDurationMultiplier - 1) * 100);
  set('Condition Duration', (facts.conditionDurationMultiplier - 1) * 100);
  for (const [name, condition] of Object.entries(CONDITION_DURATION_KEYS))
    set(name, (facts.conditionDurationMultipliers[condition] - 1) * 100);
  // The strip needs only generic player factors; occurrence diagnostics collect their own modifier details.
  set('Strike Multiplier', facts.strikeMultiplier);
  set('Condition Multiplier', facts.conditionMultiplier);
  set('Target Armor', Number(config.target?.armor) || 2597);
  return { attributes };
}
