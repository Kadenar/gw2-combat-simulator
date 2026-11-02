/** Canonical rotation commands shared by scenario tests, so fixtures read like saved rotations. */

/** Waits the given number of milliseconds before the next command. */
export const wait = (durationMs) => ({ type: 'wait', durationMs });

/** Casts a skill by canonical ID; optional fields carry interrupt, concurrency, or release timing. */
export const cast = (skillId, fields = {}) => ({ type: 'cast', skillId, ...fields });
