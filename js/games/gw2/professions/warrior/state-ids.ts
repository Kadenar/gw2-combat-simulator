/** Stable public identities belong to mechanics, independently of runtime names and display labels. */
export const WARRIOR_STATE_IDS = Object.freeze({
  ADRENALINE: 'gw2.warrior.adrenaline',
  BERSERK_UNTIL: 'gw2.berserker.berserk-until',
  ATTACKER_INSIGHT_EXPIRIES: 'gw2.spellbreaker.attacker-insight-expiries',
  MAGEBANE_TETHER_UNTIL: 'gw2.spellbreaker.magebane-tether-until',
  FLOW: 'gw2.bladesworn.flow',
  DRAGON_CHARGES: 'gw2.bladesworn.dragon-charges',
  FLOW_STABILIZER_WINDOWS: 'gw2.bladesworn.flow-stabilizer-windows',
  TRAIT_POSITIVE_FLOW_STARTED_AT: 'gw2.bladesworn.trait-positive-flow-started-at',
  TRAIT_POSITIVE_FLOW_UNTIL: 'gw2.bladesworn.trait-positive-flow-until',
  TRAIT_POSITIVE_FLOW_STACKS: 'gw2.bladesworn.trait-positive-flow-stacks',
  GUNSABER_ACTIVE: 'gw2.bladesworn.gunsaber-active',
  OVERCHARGED_CARTRIDGE_WINDOWS: 'gw2.bladesworn.overcharged-cartridge-windows',
  DRAGON_TRIGGER_ACTIVE: 'gw2.bladesworn.dragon-trigger-active',
  MOTIVATION: 'gw2.paragon.motivation',
  ACTIVE_REFRAIN: 'gw2.paragon.active-refrain'
} as const);
