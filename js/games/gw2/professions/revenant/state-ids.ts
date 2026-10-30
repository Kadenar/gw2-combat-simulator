/** Stable public identities belong to mechanics, independently of runtime names and display labels. */
export const REVENANT_STATE_IDS = Object.freeze({
  ENERGY: 'gw2.revenant.energy',
  ACTIVE_LEGEND_ID: 'gw2.revenant.active-legend-id',
  SELECTED_LEGEND_IDS: 'gw2.revenant.selected-legend-ids',
  ACTIVE_UPKEEPS: 'gw2.revenant.active-upkeeps',
  ENCHANTED_DAGGERS: 'gw2.revenant.enchanted-daggers',
  CRUSHING_ABYSS: 'gw2.revenant.crushing-abyss',
  COMBAT_BEGAN_AT: 'gw2.revenant.combat-began-at',
  AFFINITY: 'gw2.conduit.affinity',
  COSMIC_WISDOM_UNTIL: 'gw2.conduit.cosmic-wisdom-until',
  CONDUIT_FORM: 'gw2.conduit.conduit-form',
  BEGUILING_HAZE_CHARGES: 'gw2.conduit.beguiling-haze-charges',
  BEGUILING_HAZE_READY_AT: 'gw2.conduit.beguiling-haze-ready-at',
  KALLAS_FERVOR: 'gw2.renegade.kallas-fervor',
  RAZORCLAWS_RAGE: 'gw2.renegade.razorclaws-rage',
  REAVERS_CURSE_UNTIL: 'gw2.vindicator.reavers-curse-until'
} as const);
