/** Owns the simulation/config.ts contracts so type dependencies follow their runtime feature boundaries. */

/** Reject unknown policies at the simulation boundary; absent settings use the averaged baseline. */
export function normalizeCriticalDamageMode(mode: unknown = 'averaged'): Gw2CriticalDamageMode {
  if (mode !== 'averaged' && mode !== 'rolled') throw new TypeError(`Invalid critical damage mode: ${String(mode)}`);
  return mode;
}

export type Gw2CriticalDamageMode = 'averaged' | 'rolled';
