/** Explicit ordered chains owned by Core elementalist; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

export const ELEMENTALIST_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.FIRE_STRIKE, ID.FIRE_SWIPE, ID.SEARING_SLASH],
  [ID.SEICHE, ID.CLAPOTIS, ID.BREAKING_WAVE],
  [ID.CHARGED_STRIKE, ID.POLARIC_SLASH, ID.CALL_LIGHTNING],
  [ID.CRYSTAL_SLASH, ID.CRYSTALLINE_STRIKE, ID.CRYSTALLINE_SUNDER],
  [ID.LIGHTNING_SWING, ID.STATIC_SWING, ID.THUNDERCLAP],
  [ID.STREAM_STRIKE, ID.WATER_RUSH, ID.CHILLING_CRACK],
  // Aerial Agility is a manual sequence using the same controller; its skills explicitly set autoattack: false.
  [ID.AERIAL_AGILITY, ID.AERIAL_AGILITY_CHAIN, ID.AERIAL_AGILITY_DASH]
]);
