/** Stable public identities belong to mechanics, independently of runtime names and display labels. */
export const ENGINEER_STATE_IDS = Object.freeze({
  ACTIVE_KIT: 'gw2.engineer.active-kit',
  LIGHTNING_ROD_CHARGE_EXPIRIES: 'gw2.engineer.lightning-rod-charge-expiries',
  KINETIC_CHARGES: 'gw2.engineer.kinetic-charges',
  SELECTED_MORPH_SKILL_IDS: 'gw2.amalgam.selected-morph-skill-ids',
  EVOLVED_UNTIL: 'gw2.amalgam.evolved-until',
  PLASMATIC_STATE_UNTIL: 'gw2.amalgam.plasmatic-state-until',
  RAPACIOUS_UNTIL: 'gw2.amalgam.rapacious-until',
  PREDATOR_UNTIL: 'gw2.amalgam.predator-until',
  TITANIC_UNTIL: 'gw2.amalgam.titanic-until',
  BERSERKER_UNTIL: 'gw2.amalgam.berserker-until',
  HEAT: 'gw2.holosmith.heat',
  PHOTON_FORGE_ACTIVE: 'gw2.holosmith.photon-forge-active',
  FORGE_EXITED_AT: 'gw2.holosmith.forge-exited-at',
  OVERHEATED: 'gw2.holosmith.overheated',
  KIT_LOCKOUT_UNTIL: 'gw2.holosmith.kit-lockout-until',
  MECH: 'gw2.mechanist.mech'
} as const);
