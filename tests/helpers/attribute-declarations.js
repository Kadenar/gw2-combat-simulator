import { applyAttributeContributions, attributeContext } from '#gw2/platform/builds/attribute-evaluation.js';

/** Isolate an owner's declarations while preserving patch context and the shared arithmetic stages. */
export function evaluateAttributeDeclarations(context, initial, calculate) {
  const catalog = context.catalog ?? context.helpers ?? context.profession?.catalog;
  return applyAttributeContributions(
    attributeContext({ time: 0, ...context, catalog }, { catalog, modifierRulesById: new Map() }),
    initial,
    calculate
  );
}
