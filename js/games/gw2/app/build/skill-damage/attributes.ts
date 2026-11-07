/** Calculates the skill-damage stat strip from the same full-health runtime used by its measurements. */
import { createSkillDamagePreview } from '#gw2/app/build/skill-damage/preview.js';
import type { AttributePreviewInput } from '#gw2/app/build/types.js';
import { derivedAttribute, PRIMARY_ATTRIBUTES } from '#gw2/platform/attributes/calculation.js';
import type { Gw2NumericStatKey } from '#gw2/platform/attributes/stats.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { PreviewControl } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { queryDamagePreview } from '#gw2/platform/skill-damage/query-preview.js';

/** The damage strip queries the same prepared runtime as its rows, at full player health and without a skill override. */
export function calculateSkillDamageAttributes(
  input: AttributePreviewInput,
  rawValues: Readonly<Record<string, unknown>>,
  controls: readonly PreviewControl[]
) {
  const { preview, config, inputs } = createSkillDamagePreview(input, controls, rawValues);
  const attributes = structuredClone(preview.attributeData!.attributes);
  return queryDamagePreview(input.profession, config, inputs, (runtime) => {
    const at = runtime.time;
    const event: SimulationEvent = {
      type: 'action',
      at,
      actorType: ACTOR.PLAYER,
      source: 'Player',
      sourceId: 'stat-preview'
    };
    const query = runtime.query;
    const stats = query.statsAt(at, event, runtime);
    const critical = query.critical(event, at, runtime, stats);
    const set = (name: string, final: number): void => {
      const original = attributes[name] || derivedAttribute(0);
      attributes[name] = Object.assign({}, original, { final, conditional: final - original.final });
    };

    for (const name of PRIMARY_ATTRIBUTES)
      set(name, Number(stats[(name[0].toLowerCase() + name.slice(1).replaceAll(' ', '')) as Gw2NumericStatKey]));
    set('Critical Chance', (critical.chanceBeforeCap ?? critical.chance) * 100);
    set('Critical Damage', critical.damage * 100);
    set(
      'Boon Duration',
      attributes['Boon Duration'].final +
        (stats.concentration - preview.attributeData!.attributes.Concentration.final) / 15
    );
    set('Condition Duration', (query.conditionDurationMultiplier('', at, stats, event, runtime) - 1) * 100);
    for (const name of [CONDITION.BURNING, CONDITION.BLEEDING, CONDITION.TORMENT, CONDITION.CONFUSION, 'Poison'])
      set(
        name + ' Duration',
        (query.conditionDurationMultiplier(name === 'Poison' ? CONDITION.POISONED : name, at, stats, event, runtime) -
          1) *
          100
      );
    // The strip needs only generic player factors; occurrence diagnostics collect their own modifier details.
    set('Strike Multiplier', query.strikeMultiplier(event, at, runtime));
    set('Condition Multiplier', query.conditionMultiplier('', at, event, runtime));
    set('Target Armor', Number(config.target?.armor) || 2597);
    return { attributes };
  });
}
