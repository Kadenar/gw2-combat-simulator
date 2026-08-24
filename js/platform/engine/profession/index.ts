/** Public profession authoring and runtime-selection entrypoint. */
export { createEventReactions, defineProfession, PROFESSION_HOOK_ORDER } from './contract.js';
export { defineProfessionFamily, resolveProfessionRuntime } from './family.js';
export { defineProfessionModule } from './module.js';
export {
  cloneProfessionState,
  defineProfessionSpecializationState,
  flattenProfessionState,
  professionCoreState
} from './state.js';
export type { ProfessionSpecializationStateDefinition } from './state.js';
export { createProfessionFamilyUi } from './ui.js';
export type { ProfessionFamilyUiDefinition } from './ui.js';
