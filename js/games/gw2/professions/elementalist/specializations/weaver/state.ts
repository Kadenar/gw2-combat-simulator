import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { isElementalistAttunement, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';

/**
 * Runtime state Weaver owns on top of the Elementalist core, which keeps the
 * main-hand (primary) attunement: the off-hand element plus the expiry stamps
 * for Unravel, Weave Self / Perfect Weave, Fervent Stance, and the Superior
 * Elements internal cooldown.
 */
export interface WeaverState {
  secondaryAttunement: ElementalistAttunement | null;
  unravelUntil: number;
  weaveSelfUntil: number;
  weaveSelfVisited: string[];
  perfectWeaveUntil: number;
  ferventStanceUntil: number;
  superiorElementsReadyAt: number;
}

/**
 * Specialization state handle: `create` seeds a fresh state from the build (the
 * off-hand element falls back to the starting attunement, then Fire) and `from`
 * resolves the Weaver slice out of any scheduler or resolver context.
 */
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

/** State factory the module registers for both the scheduler and the resolver. */
export const createWeaverState = weaverState.create;

// Weaver owns dual-attunement state and its public stance windows.
/** Keys the Elementalist end-state projection publishes on the simulation result. */
export const WEAVER_PUBLIC_END_STATE_KEYS = Object.freeze([
  'secondaryAttunement',
  'unravelUntil',
  'weaveSelfUntil',
  'weaveSelfVisited',
  'perfectWeaveUntil',
  'ferventStanceUntil'
] as const satisfies readonly (keyof WeaverState)[]);

/** Values reported for those keys when the build is not running Weaver. */
export const WEAVER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<WeaverState>> = Object.freeze({
  secondaryAttunement: null,
  unravelUntil: 0,
  weaveSelfUntil: 0,
  weaveSelfVisited: [],
  perfectWeaveUntil: 0,
  ferventStanceUntil: 0
});
