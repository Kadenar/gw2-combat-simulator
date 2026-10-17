import { ACTOR } from '#gw2/platform/constants.js';

// Validate ownership without allocating a new list for every damage/modifier query.
export const ACTOR_TYPES: ReadonlySet<string> = new Set(Object.values(ACTOR));
