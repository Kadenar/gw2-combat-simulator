import { applyEnhancedPotencyAttributes } from '#gw2/professions/elementalist/specializations/evoker/traits/familiars.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';
/**
 * Evoker damage and attribute modifiers.
 *
 * Declarative rules evaluated per damage event, plus an attribute pass for the
 * bonuses that must land on ferocity and condition damage before those
 * attributes feed into scaling.
 */
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';

/** Zap retains its skill-owned damage window; trait rules come from registered definitions. */
const evokerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.zap',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.03,
    when: (context: ElementalistModifierContext) =>
      context.config?.evokerElement === 'Air' && elementalistTimedBuffStacks(context, 'zap buff', 1) > 0
  }
]);

/**
 * Evoker's damage/attribute contributions: declarative modifier rules plus the
 * attribute pass that must run before crit and condition scaling are computed.
 */
export const evokerModifiers = Object.freeze({
  modifyAttributes: applyEnhancedPotencyAttributes,
  modifierRules: evokerModifierRules
});
