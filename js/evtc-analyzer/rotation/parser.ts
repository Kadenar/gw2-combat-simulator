import { parseEvtc } from '../parser.js';
import type { EvtcRotationReconstruction } from '../types.js';
import type { EvtcRotationCatalog } from './catalog.js';
import type { EvtcRotationOptions } from './reconstruct.js';
import { reconstructEvtcRotation } from './registry.js';

/** Parses expanded EVTC bytes and reconstructs the selected player's rotation. */
export function parseEvtcRotation(
  input: ArrayBuffer | Uint8Array,
  catalog: EvtcRotationCatalog | null = null,
  options: EvtcRotationOptions = {}
): EvtcRotationReconstruction {
  return reconstructEvtcRotation(parseEvtc(input), catalog, options);
}
