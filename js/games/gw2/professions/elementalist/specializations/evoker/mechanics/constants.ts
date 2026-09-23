/**
 * Static Evoker lookup tables shared by the mechanics modules.
 *
 * Stable skill-ID membership sets and maps only - anything numeric that balance can
 * retune is declared in `profiles.ts` and read through the shared contract.
 */
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

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
/** Weapon skills exempted from familiar charge generation despite sitting in slots 2-5. */
export const EVOKER_NO_CHARGE_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.TRANSMUTE_EARTH,
  ID.HURL,
  ID.TRANSMUTE_FROST,
  ID.TRANSMUTE_LIGHTNING,
  ID.TRANSMUTE_FIRE,
  ID.GRAND_FINALE
]);
/** Shared icon for every Electric Enchantment proc entry in the log. */
export const ELECTRIC_ENCHANTMENT_ICON = 'https://wiki.guildwars2.com/images/7/7b/Hare%27s_Agility.png';
/** Meditation skills whose named profile effects grant Altruistic Aspect boons. */
export const ALTRUISTIC_ASPECT_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.FOXS_FURY,
  ID.HARES_AGILITY,
  ID.TOADS_FORTITUDE,
  ID.ELEMENTAL_PROCESSION
]);
/** Lesser and completed spear etchings excluded from charge generation. */
export const EVOKER_NO_CHARGE_SPEAR_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.LESSER_VOLCANO,
  ID.VOLCANO,
  ID.LESSER_JO_KULHLAUP,
  ID.JO_KULHLAUP,
  ID.LESSER_DERECHO,
  ID.DERECHO,
  ID.LESSER_HABOOB,
  ID.HABOOB
]);
/** Basic-to-empowered identity; delays and interruption windows belong to the profiles. */
export const FAMILIAR_EMPOWERED_BY_BASIC: ReadonlyMap<SkillId, SkillId> = new Map([
  [ID.IGNITE, ID.CONFLAGRATION],
  [ID.ZAP, ID.LIGHTNING_BLITZ],
  [ID.SPLASH, ID.BUOYANT_DELUGE],
  [ID.CALCIFY, ID.SEISMIC_IMPACT]
]);
/** Balance profile that owns each basic familiar's timing values. */
export const FAMILIAR_PROFILE_BY_BASIC: ReadonlyMap<SkillId, SkillId> = new Map([
  [ID.IGNITE, PROFILE.ignite],
  [ID.SPLASH, PROFILE.splash],
  [ID.ZAP, PROFILE.zap],
  [ID.CALCIFY, PROFILE.calcify]
]);
/** Reverse index of the flip pairing: empowered familiar ID back to its basic form. */
export const FAMILIAR_BASIC_BY_EMPOWERED: ReadonlyMap<SkillId, SkillId> = new Map(
  [...FAMILIAR_EMPOWERED_BY_BASIC].map(([basic, empowered]) => [empowered, basic])
);
