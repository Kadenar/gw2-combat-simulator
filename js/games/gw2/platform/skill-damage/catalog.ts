import { hasDamage } from '#gw2/platform/skill-damage/execute.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';
import { RELIC_RULES } from '#gw2/platform/equipment/relics/rules/index.js';
import { SIGIL_DATA, SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { SkillDamageOccurrence } from '#gw2/platform/skill-damage/types.js';

/** Enumerate selected damage owners from declarations; trigger eligibility never changes this list. */
export function damageOccurrences(profession: RuntimeProfession<object>, config: Gw2Config): SkillDamageOccurrence[] {
  const selected = new Set(config.selectedTraitIds ?? []);
  const result: SkillDamageOccurrence[] = [];
  for (const profile of profession.catalog.balanceProfiles) {
    const ownerId =
      typeof profile.parentId === 'number' || typeof profile.parentId === 'string' ? profile.parentId : profile.id;
    if (
      !selected.has(ownerId) ||
      profile.damagePreviewAttribution ||
      profession.damageEffects?.some((entry) => entry.ownerId === ownerId) ||
      !hasDamage(profile.effects)
    )
      continue;
    const trait = profession.catalog.traits.find((entry) => entry.id === ownerId);
    result.push({
      id: `profile:${profile.id}`,
      name: profile.name,
      icon: String(trait?.icon ?? profile.icon ?? ''),
      source: 'Trait',
      unit: 'occurrence',
      effect: { kind: 'profile', id: profile.id, ownerId }
    });
  }

  for (const declared of profession.damageEffects ?? []) {
    if (declared.ownerId != null && !selected.has(declared.ownerId)) continue;
    result.push({
      id: `profession:${declared.id}`,
      effect: { kind: 'profession', id: declared.id },
      name: declared.name,
      icon:
        declared.icon ??
        String(
          profession.catalog.traits.find((trait) => trait.id === declared.ownerId)?.icon ??
            profession.catalog.skillsById.get(declared.sourceIds[0])?.icon ??
            ''
        ),
      source: declared.source,
      unit: declared.unit,
      inputs: declared.inputs,
      assumptions: declared.assumptions
    });
  }

  for (const name of new Set([config.relic, ...(config.precastRelics ?? [])].filter(Boolean))) {
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
