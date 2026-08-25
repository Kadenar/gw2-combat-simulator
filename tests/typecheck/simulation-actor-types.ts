import type { SimulationActorType } from '../../js/platform/engine/types.js';

type Assert<T extends true> = T;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;

// Mesmer illusion subtypes cannot leak into the shared actor ownership union.
export type SimulationActorTypeAssertions = [
  Assert<Equal<SimulationActorType, 'player' | 'summon' | 'effect' | 'unknown'>>
];
