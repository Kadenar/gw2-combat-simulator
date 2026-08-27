import { CONDITION_DURATION_ATTRIBUTES, PRIMARY_ATTRIBUTES } from '../../../platform/builds/attributes.js';

// Build-panel metadata centralizes the attribute, condition, and armor choices shared by renderers.

export { PRIMARY_ATTRIBUTES };

export const DERIVED_ATTRIBUTES = Object.freeze([
  'Critical Chance',
  'Critical Damage',
  'Condition Duration',
  'Boon Duration',
  'Bleeding Duration',
  'Burning Duration',
  'Confusion Duration',
  'Poison Duration',
  'Torment Duration'
]);

export const PERCENT_ATTRIBUTES = new Set(DERIVED_ATTRIBUTES);

export const SPECIFIC_CONDITION_DURATION_ATTRIBUTES = new Set([...CONDITION_DURATION_ATTRIBUTES]);

export const TARGET_CONDITION_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Damaging',
    conditions: Object.freeze(['Burning', 'Bleeding', 'Torment', 'Confusion', 'Poisoned'])
  }),
  Object.freeze({
    label: 'Control',
    conditions: Object.freeze([
      'Vulnerability',
      'Weakness',
      'Blindness',
      'Slow',
      'Chilled',
      'Cripple',
      'Immobilize',
      'Fear',
      'Taunt'
    ])
  })
]);

export const STACKING_TARGET_CONDITIONS = new Set(['Vulnerability', 'Bleeding', 'Torment', 'Confusion']);

export const DEFAULT_TARGET_ARMOR = 2597;

export const TARGET_ARMOR_OPTIONS = Object.freeze([
  Object.freeze({ value: DEFAULT_TARGET_ARMOR, label: 'Base' }),
  Object.freeze({ value: 1910, label: 'Vale Guardian / Keep Construct' }),
  Object.freeze({ value: 5346, label: 'McLeod' }),
  Object.freeze({ value: 2460, label: 'Berg' }),
  Object.freeze({ value: 2323, label: 'Zane' }),
  Object.freeze({ value: 2184, label: 'Narella' })
]);

export function normalizeTargetArmor(value: number | string): number {
  const armor = Number(value);
  return Number.isFinite(armor) ? Math.max(1, armor) : DEFAULT_TARGET_ARMOR;
}
