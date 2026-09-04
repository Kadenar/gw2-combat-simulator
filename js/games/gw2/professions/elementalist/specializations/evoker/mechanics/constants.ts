/**
 * Static Evoker lookup tables shared by the mechanics modules.
 *
 * Stable skill-ID membership sets and maps only - anything numeric that balance can
 * retune is declared in `profiles.ts` and read through it, with the literals
 * here serving as fallbacks.
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
/** Fallback recharge applied to the attunements an Evoker swap is not entering. */
export const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
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
/** Conjure bundles; their weapon skills never generate familiar charges. */
export const CONJURED_WEAPONS = new Set(['Frost Bow', 'Lightning Hammer', 'Fiery Greatsword']);
/** Fallback boon package Altruistic Aspect grants per meditation skill when the balance profile has no matching effect. */
export const ALTRUISTIC_ASPECT_BOONS: ReadonlyMap<SkillId, readonly [kind: string, stacks: number, duration: number]> =
  new Map([
    [ID.FOXS_FURY, ['Might', 3, 10]],
    [ID.HARES_AGILITY, ['Fury', 1, 5]],
    [ID.TOADS_FORTITUDE, ['Stability', 1, 5]],
    [ID.ELEMENTAL_PROCESSION, ['Resistance', 1, 5]]
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
// seconds after basic familiar cast before the empowered flip skill becomes available
export const FAMILIAR_FLIP_DELAYS: ReadonlyMap<SkillId, readonly [SkillId, number]> = new Map([
  [ID.IGNITE, [ID.CONFLAGRATION, 0.96]],
  [ID.ZAP, [ID.LIGHTNING_BLITZ, 0.68]],
  [ID.SPLASH, [ID.BUOYANT_DELUGE, 0.84]],
  [ID.CALCIFY, [ID.SEISMIC_IMPACT, 0.28]]
]);
// if the basic familiar fires within this many seconds after its empowered form, the empowered form's effects are cancelled
export const FAMILIAR_INTERRUPT_WINDOWS: ReadonlyMap<SkillId, readonly [SkillId, number]> = new Map([
  [ID.IGNITE, [ID.CONFLAGRATION, 2.4]],
  [ID.ZAP, [ID.LIGHTNING_BLITZ, 2.3]],
  [ID.SPLASH, [ID.BUOYANT_DELUGE, 2.4]],
  [ID.CALCIFY, [ID.SEISMIC_IMPACT, 2.2]]
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
  [...FAMILIAR_INTERRUPT_WINDOWS].map(([basic, [empowered]]) => [empowered, basic])
);
