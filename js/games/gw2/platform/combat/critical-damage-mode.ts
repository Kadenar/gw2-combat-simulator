/** Selects whether strikes apply expected critical damage or each hit's sampled critical outcome. */

/** Reject unknown policies at the simulation boundary; absent settings use seeded critical rolls. */
export function normalizeCriticalDamageMode(mode: unknown = 'rolled'): Gw2CriticalDamageMode {
  if (mode !== 'averaged' && mode !== 'rolled') throw new TypeError(`Invalid critical damage mode: ${String(mode)}`);

  return mode;
}

export type Gw2CriticalDamageMode = 'averaged' | 'rolled';
