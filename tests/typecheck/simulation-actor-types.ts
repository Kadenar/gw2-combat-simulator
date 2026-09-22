import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';

type Assert<T extends true> = T;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;

// Every event requires canonical ownership; illusion subtypes belong in separate metadata.
export type SimulationActorTypeAssertions = [
  Assert<Equal<SimulationActorType, 'player' | 'summon' | 'effect' | 'environment' | 'unknown'>>,
  Assert<Equal<SimulationEventBase['actorType'], SimulationActorType>>
];
