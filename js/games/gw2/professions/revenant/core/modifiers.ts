import { modifyCoreAttributes } from '#gw2/professions/revenant/core/traits/devastation/attributes.js';
import { modifyCoreCriticalChance } from '#gw2/professions/revenant/core/traits/invocation/queries.js';

export const revenantCoreModifiers = Object.freeze({
  modifyAttributes: modifyCoreAttributes,
  modifyCriticalChance: modifyCoreCriticalChance
});
