import type { EffectPatch, ProvisionalParameter } from '#gw2/integrations/patches/authoring/patches.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';

/** Replace tuning for the same selector while preserving its other authored fields and unrelated effect edits. */
export function replaceProvisionalEffect(
  effects: readonly EffectPatch[],
  parameter: ProvisionalParameter,
  value: number
): readonly EffectPatch[] {
  const keys = ['effectIndex', 'type', 'name', 'condition', 'boon', 'all'] as const;
  const matches = (effect: EffectPatch) =>
    effect.tickIndex === undefined && keys.every((key) => effect[key] === parameter.effect?.[key]);
  const previous = effects.filter(matches);
  const replacement = Object.assign({}, ...previous, parameter.effect, { [parameter.field]: value });
  return [...effects.filter((effect) => !matches(effect)), replacement];
}

/** Validate controls against the fully patched defaults before any UI can try to render them. */
export function validateProvisionalCatalog(
  catalog: Readonly<CanonicalCatalog>,
  parameters: readonly ProvisionalParameter[] | undefined
): void {
  for (const parameter of parameters ?? []) {
    if (!catalog.traits.some((trait) => String(trait.id) === parameter.traitId))
      throw new TypeError(`Unknown provisional trait ${parameter.traitId}.`);

    const value = provisionalValue(catalog, parameter);

    if (
      value < parameter.minimum ||
      value > parameter.maximum ||
      (['charges', 'stacks'].includes(parameter.unit) && !Number.isInteger(value))
    )
      throw new TypeError(`Provisional default ${parameter.id} is outside its allowed range.`);
  }
}

/** Read an explicitly exposed scalar or effect value from the selected catalog, never from stale UI defaults. */
export function provisionalValue(catalog: Readonly<CanonicalCatalog>, parameter: ProvisionalParameter): number {
  const profile = catalog.balanceProfiles.find((entry) => String(entry.id) === parameter.profileId);

  if (!profile) throw new TypeError(`Unknown provisional profile ${parameter.profileId}.`);

  const effects = parameter.effect
    ? (profile.effects ?? []).filter((effect, index) =>
        Object.entries(parameter.effect!).every(
          ([key, value]) =>
            key === 'all' || (key === 'effectIndex' ? index === value : effect[key as keyof typeof effect] === value)
        )
      )
    : [];

  if (parameter.effect && effects.length !== 1)
    throw new TypeError(`Provisional value ${parameter.id} must select one effect.`);

  const value = (parameter.effect ? effects[0] : profile)[parameter.field as keyof typeof profile];

  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`Provisional value ${parameter.id} requires a numeric field.`);

  return value;
}

/** Only balance-profile numbers can vary in session; skills and modifier declarations require authored edits. */
export function validateProvisionalParameters(parameters: readonly ProvisionalParameter[] | undefined): void {
  if (parameters === undefined) return;

  if (!Array.isArray(parameters)) throw new TypeError('Provisional parameters must be an array.');

  const ids = new Set<string>();
  for (const parameter of parameters) {
    if (
      !parameter ||
      Object.keys(parameter).some(
        (key) =>
          ![
            'id',
            'label',
            'profileId',
            'specialization',
            'traitId',
            'field',
            'effect',
            'unit',
            'minimum',
            'maximum',
            'step'
          ].includes(key)
      ) ||
      !parameter.id ||
      ids.has(parameter.id) ||
      !parameter.label ||
      !parameter.profileId ||
      typeof parameter.traitId !== 'string' ||
      !parameter.traitId.trim() ||
      !parameter.specialization ||
      !parameter.field ||
      !['%', 's', 'charges', 'stacks', 'endurance', 'coefficient'].includes(parameter.unit) ||
      ![parameter.minimum, parameter.maximum, parameter.step].every(Number.isFinite) ||
      parameter.minimum < 0 ||
      parameter.maximum < parameter.minimum ||
      parameter.step <= 0
    )
      throw new TypeError('Invalid provisional parameter declaration.');

    ids.add(parameter.id);
  }
}
