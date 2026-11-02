import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

/**
 * Keeps presentation and attribute previews on the same selected balance declarations as simulation. Profession
 * presentation reads its catalog as its own skill type; shared callers see the base type.
 */
export interface ProfessionBalanceContext<TSkill extends Skill = Skill> {
  readonly catalog: Readonly<CanonicalCatalog<TSkill>>;
  readonly modifierRulesById: ReadonlyMap<string, Gw2ModifierRule>;
}
