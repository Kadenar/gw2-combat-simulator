import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { ElementalKind } from '#gw2/professions/elementalist/core/mechanics/elementals/attacks.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

export interface ElementalStrikeBoundary {
  readonly summonGeneration: number;
  readonly element: ElementalKind;
  readonly companionId: string;
  readonly activationId: string;
  readonly emissionCast?: EffectDelivery['cast'];
}

interface ElementalLifecycleObserver {
  beforeStrike(context: ElementalistRuntime, strike: ElementalStrikeBoundary): void;
  retire(context: ElementalistRuntime, summonGeneration: number): void;
}

const observers = new WeakMap<ElementalistRuntime, ElementalLifecycleObserver>();

/** Core exposes actor lifetime and strike boundaries; the active elite owns any attached effect policy. */
export function registerElementalLifecycle(context: ElementalistRuntime, observer: ElementalLifecycleObserver): void {
  observers.set(context, observer);
}

/** Called only for accepted impacts, before the elemental submits its own strike. */
export function beforeElementalStrike(context: ElementalistRuntime, strike: ElementalStrikeBoundary): void {
  observers.get(context)?.beforeStrike(context, strike);
}

/** Replacement and expiry retire effects bound to the outgoing generation. */
export function retireElemental(context: ElementalistRuntime, summonGeneration: number): void {
  observers.get(context)?.retire(context, summonGeneration);
}
