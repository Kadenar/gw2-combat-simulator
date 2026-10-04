import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

/** Keeps presentation and attribute previews on the same selected balance declarations as simulation. */
export interface ProfessionBalanceContext {
  readonly catalog: Readonly<CanonicalCatalog>;
  readonly modifierRulesById: ReadonlyMap<string, Gw2ModifierRule>;
}
