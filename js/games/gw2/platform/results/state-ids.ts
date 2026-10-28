/** Shared planning identities let generic consumers read the same fact across professions. */
export const SHARED_STATE_IDS = Object.freeze({
  PRIMARY_ATTUNEMENT: 'gw2.profession.primary-attunement',
  AUTOATTACK_CHAINS: 'gw2.profession.autoattack-chains',
  ENDURANCE: 'gw2.profession.endurance',
  AVAILABLE_FLIPS: 'gw2.profession.available-flips',
  RESOURCE: 'gw2.profession.resource',
  RESOURCE_DEFINITION: 'gw2.profession.resource-definition',
  AVAILABLE_AMBUSH: 'gw2.profession.available-ambush',
  STEALTH_STARTED_AT: 'gw2.profession.stealth-started-at',
  STEALTH_UNTIL: 'gw2.profession.stealth-until',
  REVEALED_UNTIL: 'gw2.profession.revealed-until',
  SELF_CONDITIONS: 'gw2.profession.self-conditions',
  ACTIVE_LOADOUT_ID: 'gw2.profession.active-loadout-id'
} as const);
