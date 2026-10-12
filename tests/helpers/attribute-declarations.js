import { applyAttributeContributions, attributeContext } from '#gw2/platform/builds/attribute-evaluation.js';
import { attributeSeed } from '#gw2/platform/builds/attribute-inputs.js';

/** Isolate an owner's declarations while preserving patch context and the shared arithmetic stages. */
export function evaluateAttributeDeclarations(context, initial, calculate) {
  const catalog = context.catalog ?? context.helpers ?? context.profession?.catalog;
  const facts = attributeContext({ time: 0, ...context, catalog }, { catalog, modifierRulesById: new Map() });
  return applyAttributeContributions(attributeSeed(context.config ?? {}, facts.weaponSet), initial, calculate(facts));
}
