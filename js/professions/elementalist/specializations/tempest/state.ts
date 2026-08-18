import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';

export type TempestState = Record<string, never>;

export const tempestState = defineProfessionSpecializationState('Tempest', (): TempestState => ({}));

export const createTempestState = tempestState.create;
