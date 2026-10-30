/** Stable public identities belong to mechanics, independently of runtime names and display labels. */
export const NECROMANCER_STATE_IDS = Object.freeze({
  LIFE_FORCE: 'gw2.necromancer.life-force',
  ACTIVE_SHROUD: 'gw2.necromancer.active-shroud',
  SOUL_SHARD_GRANT: 'gw2.necromancer.soul-shard-grant',
  CARAPACE_EXPIRIES: 'gw2.necromancer.carapace-expiries',
  ACTIVE_MINIONS: 'gw2.necromancer.active-minions',
  BLIGHT: 'gw2.harbinger.blight',
  BLIGHT_EXPIRIES: 'gw2.harbinger.blight-expiries',
  CASCADING_CORRUPTION_STACKS: 'gw2.harbinger.cascading-corruption-stacks',
  MELTDOWN_UNTIL: 'gw2.harbinger.meltdown-until',
  ACTIVE_SPIRITS: 'gw2.ritualist.active-spirits',
  SOUL_TWISTING_AVAILABLE: 'gw2.ritualist.soul-twisting-available',
  SHADES: 'gw2.scourge.shades'
} as const);
