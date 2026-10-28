/** Stable public identities belong to mechanics, independently of runtime names and display labels. */
export const RANGER_STATE_IDS = Object.freeze({
  PET: 'gw2.ranger.pet',
  ACTIVE_PET_SLOT: 'gw2.ranger.active-pet-slot',
  PET_NAMES: 'gw2.ranger.pet-names',
  WINTER_BITE_READY: 'gw2.ranger.winter-bite-ready',
  QUICK_DRAW: 'gw2.ranger.quick-draw',
  SHARPENING_STONE_GRANTS: 'gw2.ranger.sharpening-stone-grants',
  ASTRAL_CLOCK: 'gw2.druid.astral-clock',
  CELESTIAL_AVATAR_ENDS_AT: 'gw2.druid.celestial-avatar-ends-at',
  CYCLONE_BOW_ACTIVE: 'gw2.galeshot.cyclone-bow-active',
  ARROWS: 'gw2.galeshot.arrows',
  WIND_FORCE: 'gw2.galeshot.wind-force',
  GALE_FORCE_UNTIL: 'gw2.galeshot.gale-force-until',
  MISTRAL_UNTIL: 'gw2.galeshot.mistral-until',
  MISSILE_HITS: 'gw2.galeshot.missile-hits',
  BEASTMODE_ACTIVE: 'gw2.soulbeast.beastmode-active',
  ONE_WOLF_PACK_UNTIL: 'gw2.soulbeast.one-wolf-pack-until',
  RANGER_UNLEASHED: 'gw2.untamed.ranger-unleashed',
  AMBUSH_READY_UNTIL: 'gw2.untamed.ambush-ready-until',
  FEROCIOUS_SYMBIOSIS_PLAYER: 'gw2.untamed.ferocious-symbiosis-player'
} as const);
