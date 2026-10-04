import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

/** Tempest has no private mechanic state; its proc deadlines belong to the shared registry. */
export type TempestState = Record<string, never>;

/** Declares the 'Tempest' specialization state slot plus its typed accessor for hooks and traits. */
export const tempestState = defineProfessionSpecializationState('Tempest', (): TempestState => ({}));
