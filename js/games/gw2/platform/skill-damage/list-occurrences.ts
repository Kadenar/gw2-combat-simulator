import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';
import { normalizePrecastRelics } from '#gw2/platform/equipment/relics/catalog.js';
import { SIGIL_DATA, SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { SkillDamageOccurrence } from '#gw2/platform/skill-damage/types.js';

/** Enumerate standalone mechanic and equipment payloads; traits are collected from actual skill executions. */
export function damageOccurrences(profession: RuntimeProfession<object>, config: Gw2Config): SkillDamageOccurrence[] {
  const result: SkillDamageOccurrence[] = [];
  for (const declared of profession.damageEffects ?? []) {
    result.push({
      id: `profession:${declared.id}`,
      effect: { kind: 'profession', id: declared.id },
      name: declared.name,
      icon: declared.icon ?? profession.catalog.skillsById.get(declared.sourceIds[0])?.icon ?? '',
      source: declared.source,
      unit: declared.unit,
      inputs: declared.inputs,
      assumptions: declared.assumptions
    });
  }

  // Enumeration and runtime creation must agree on which precast relics the build actually supports.
  for (const name of new Set([config.relic, ...normalizePrecastRelics(config.precastRelics)].filter(Boolean))) {
    const relic = (RELIC_DATA as Readonly<Record<string, { id: number; icon: string }>>)[name!];

    if (relic && RELIC_RULES[relic.id]?.damagePayload)
      result.push({
        id: `relic:${relic.id}`,
        effect: { kind: 'relic', id: relic.id },
        name: `Relic of ${name}`,
        source: 'Relic',
        icon: relic.icon,
        unit: 'occurrence'
      });
  }

  const sigils = (config.sigilSets ?? []).map((set) => set.names ?? []);
  for (const name of new Set(sigils.flat().filter(Boolean))) {
    const sigil = SIGIL_DATA[name];
    const proc = sigil && SIGIL_PROCS[sigil.id as keyof typeof SIGIL_PROCS];

    if (!proc || !['strike', 'condition', 'strike-condition', 'next-hit-condition'].includes(proc.effect)) continue;

    result.push({
      id: `sigil:${sigil.id}`,
      effect: { kind: 'sigil', id: sigil.id },
      name: `Sigil of ${name}`,
      source: 'Sigil',
      icon: sigil.icon,
      unit: proc.effect === 'next-hit-condition' ? 'charge' : 'occurrence'
    });
  }

  const food = config.food && FOOD_DATA[config.food];

  if (food && 'proc' in food && food.proc)
    result.push({
      id: `food:${config.food}`,
      effect: { kind: 'food', id: config.food },
      name: food.proc.name,
      icon: NOURISHMENT_ICON,
      source: 'Food',
      unit: 'occurrence'
    });

  return result;
}
