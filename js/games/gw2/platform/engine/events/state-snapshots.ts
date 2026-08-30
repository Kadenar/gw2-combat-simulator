import type { SchedulerContext, SimulationEvent, SimulationEventInput } from '#gw2/platform/engine/types.js';

export interface StateSnapshotEventInput extends SimulationEventInput {
  readonly state: object;
}

export interface StateSnapshotEmissionOptions {
  readonly dedupeAcrossSourceIds?: boolean;
}

type StateSnapshotEmissionContext = Pick<SchedulerContext, 'events' | 'emit'>;

function sameSnapshotObject(left: object, right: object, seen: WeakMap<object, WeakSet<object>>): boolean {
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
  } else {
    const leftPrototype = Object.getPrototypeOf(left);
    const rightPrototype = Object.getPrototypeOf(right);
    if (leftPrototype !== rightPrototype || (leftPrototype !== Object.prototype && leftPrototype !== null)) {
      return false;
    }
  }

  const matched = seen.get(left);
  if (matched?.has(right)) return true;
  if (matched) matched.add(right);
  else seen.set(left, new WeakSet([right]));

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.hasOwn(rightRecord, key) && sameSnapshotValue(leftRecord[key], rightRecord[key], seen)
    )
  );
}

/** Compares canonical plain-object snapshots exactly, including NaN and signed zero values. */
export function sameSnapshotValue(
  left: unknown,
  right: unknown,
  seen = new WeakMap<object, WeakSet<object>>()
): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  return sameSnapshotObject(left, right, seen);
}

/** Emits a complete profession snapshot without requiring profession-local envelope adapters. */
export function emitStateSnapshot(
  context: StateSnapshotEmissionContext,
  profession: string,
  at: number,
  reason: string,
  state: object,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null;
/** Emits an explicitly authored synchronization checkpoint. */
export function emitStateSnapshot(
  context: StateSnapshotEmissionContext,
  event: StateSnapshotEventInput,
  options?: StateSnapshotEmissionOptions
): SimulationEvent | null;
/** Emits one synchronization checkpoint while collapsing only redundant adjacent same-time snapshots. */
export function emitStateSnapshot(
  context: StateSnapshotEmissionContext,
  eventOrProfession: StateSnapshotEventInput | string,
  atOrOptions?: number | StateSnapshotEmissionOptions,
  reason?: string,
  state?: object,
  professionOptions: StateSnapshotEmissionOptions = {}
): SimulationEvent | null {
  const profession = typeof eventOrProfession === 'string' ? eventOrProfession : null;
  const event: StateSnapshotEventInput = profession
    ? {
        type: `${profession}.state`,
        at: Number(atOrOptions || 0),
        source: profession,
        sourceId: `${profession}.state.${reason || 'update'}`,
        actorType: 'player',
        reason: reason || '',
        state: state || {}
      }
    : (eventOrProfession as StateSnapshotEventInput);
  const options = profession ? professionOptions : (atOrOptions as StateSnapshotEmissionOptions | undefined) || {};
  const { dedupeAcrossSourceIds = false } = options;
  const previous = context.events.at(-1);
  const sameSourceId = dedupeAcrossSourceIds || previous?.sourceId === event.sourceId;
  if (
    previous?.type === event.type &&
    previous.at === event.at &&
    sameSourceId &&
    sameSnapshotValue(previous.state, event.state)
  ) {
    return null;
  }

  return context.emit(event);
}
