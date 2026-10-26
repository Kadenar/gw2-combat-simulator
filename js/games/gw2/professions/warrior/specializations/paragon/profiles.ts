import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const PARAGON_BALANCE_PROFILE_IDS = Object.freeze({ commands: 'warrior.paragon.command-echoes' });

/** Shared command cadence coordinates independent echo instances across every command. */
export const PARAGON_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: PARAGON_BALANCE_PROFILE_IDS.commands,
    name: 'Paragon Command Echoes',
    profileKind: 'mechanic',
    pulseInterval: 3,
    effects: []
  }
]);
