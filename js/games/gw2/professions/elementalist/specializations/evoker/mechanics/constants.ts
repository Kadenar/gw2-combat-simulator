/**
 * Static Evoker lookup tables shared by the mechanics modules.
 *
 * Stable profile identities and skill-ID lookup tables - anything numeric that balance can
 * retune is declared in balance profiles and read through the shared contract.
 */
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Every familiar skill ID, basic and empowered, mapped to the element it requires. */
export const FAMILIAR_ELEMENTS: ReadonlyMap<SkillId, ElementalistAttunement> = new Map([
  [ID.IGNITE, 'Fire'],
  [ID.CONFLAGRATION, 'Fire'],
  [ID.SPLASH, 'Water'],
  [ID.BUOYANT_DELUGE, 'Water'],
  [ID.ZAP, 'Air'],
  [ID.LIGHTNING_BLITZ, 'Air'],
  [ID.CALCIFY, 'Earth'],
  [ID.SEISMIC_IMPACT, 'Earth']
]);

/** The four non-empowered familiar skills: they spend the full charge bar and add an empowered stack. */
export const BASIC_FAMILIARS: ReadonlySet<SkillId> = new Set([ID.IGNITE, ID.SPLASH, ID.ZAP, ID.CALCIFY]);

/** Stable mechanic and skill-variant patch identities. */
export const EVOKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.evoker.resources',
  foxsFury: 'elementalist.evoker.foxs-fury',
  haresAgility: 'elementalist.evoker.hares-agility',
  toadsFortitude: 'elementalist.evoker.toads-fortitude',
  lightningBlitz: 'elementalist.evoker.lightning-blitz',
  ignite: 'elementalist.evoker.ignite',
  splash: 'elementalist.evoker.splash',
  zap: 'elementalist.evoker.zap',
  calcify: 'elementalist.evoker.calcify'
});
