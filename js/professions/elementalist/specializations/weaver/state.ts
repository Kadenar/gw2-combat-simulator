import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import type { ElementalistConfig } from '../../types.js';
import { isElementalistAttunement, type ElementalistAttunement } from '../../core/state.js';

export interface WeaverState {
  secondaryAttunement: ElementalistAttunement | null;
  unravelUntil: number;
  weaveSelfUntil: number;
  weaveSelfVisited: string[];
  perfectWeaveUntil: number;
  ferventStanceUntil: number;
  superiorElementsReadyAt: number;
}

export const weaverState = defineProfessionSpecializationState(
  'Weaver',
  (config: ElementalistConfig = {}): WeaverState => ({
    secondaryAttunement: isElementalistAttunement(config.secondaryAttunement)
      ? config.secondaryAttunement
      : isElementalistAttunement(config.startAttunement)
        ? config.startAttunement
        : 'Fire',
    unravelUntil: 0,
    weaveSelfUntil: 0,
    weaveSelfVisited: [],
    perfectWeaveUntil: 0,
    ferventStanceUntil: 0,
    superiorElementsReadyAt: 0
  })
);

export const createWeaverState = weaverState.create;

// Weaver owns dual-attunement state and its public stance windows.
export const WEAVER_PUBLIC_END_STATE_KEYS = Object.freeze([
  'secondaryAttunement',
  'unravelUntil',
  'weaveSelfUntil',
  'weaveSelfVisited',
  'perfectWeaveUntil',
  'ferventStanceUntil'
] as const satisfies readonly (keyof WeaverState)[]);

export const WEAVER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<WeaverState>> = Object.freeze({
  secondaryAttunement: null,
  unravelUntil: 0,
  weaveSelfUntil: 0,
  weaveSelfVisited: [],
  perfectWeaveUntil: 0,
  ferventStanceUntil: 0
});
