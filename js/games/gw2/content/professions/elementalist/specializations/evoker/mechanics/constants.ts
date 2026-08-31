/**
 * Static Evoker lookup tables shared by the mechanics modules.
 *
 * Membership sets and name-keyed maps only - anything numeric that balance can
 * retune is declared in `profiles.ts` and read through it, with the literals
 * here serving as fallbacks.
 */
import type { SkillId } from '#gw2/platform/engine/types.js';
import type { ElementalistAttunement } from '#gw2/content/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/evoker/profiles.js';

/** Every familiar skill name, basic and empowered, mapped to the element it requires. */
export const FAMILIAR_ELEMENTS: Readonly<Record<string, ElementalistAttunement>> = Object.freeze({
  Ignite: 'Fire',
  Conflagration: 'Fire',
  Splash: 'Water',
  'Buoyant Deluge': 'Water',
  Zap: 'Air',
  'Lightning Blitz': 'Air',
  Calcify: 'Earth',
  'Seismic Impact': 'Earth'
});
/** The four non-empowered familiar skills: they spend the full charge bar and add an empowered stack. */
export const BASIC_FAMILIARS = new Set(['Ignite', 'Splash', 'Zap', 'Calcify']);
/** Fallback recharge applied to the attunements an Evoker swap is not entering. */
export const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
/** Weapon skills exempted from familiar charge generation despite sitting in slots 2-5. */
export const EVOKER_NO_CHARGE_SKILLS = new Set([
  'Transmute Earth',
  'Hurl',
  'Transmute Frost',
  'Transmute Lightning',
  'Transmute Fire',
  'Grand Finale'
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
/** Completed spear etchings, excluded from charge generation alongside the 'Lesser ' variants. */
export const FULL_SPEAR_ETCHINGS = new Set(['Volcano', 'Jökulhlaup', 'Derecho', 'Haboob']);
// seconds after basic familiar cast before the empowered flip skill becomes available
export const FAMILIAR_FLIP_DELAYS: Readonly<Record<string, readonly [string, number]>> = Object.freeze({
  Ignite: ['Conflagration', 0.96],
  Zap: ['Lightning Blitz', 0.68],
  Splash: ['Buoyant Deluge', 0.84],
  Calcify: ['Seismic Impact', 0.28]
});
// if the basic familiar fires within this many seconds after its empowered form, the empowered form's effects are cancelled
export const FAMILIAR_INTERRUPT_WINDOWS: Readonly<Record<string, readonly [string, number]>> = Object.freeze({
  Ignite: ['Conflagration', 2.4],
  Zap: ['Lightning Blitz', 2.3],
  Splash: ['Buoyant Deluge', 2.4],
  Calcify: ['Seismic Impact', 2.2]
});
/** Balance profile that owns each basic familiar's timing values. */
export const FAMILIAR_PROFILE_BY_BASIC: Readonly<Record<string, SkillId>> = Object.freeze({
  Ignite: PROFILE.ignite,
  Splash: PROFILE.splash,
  Zap: PROFILE.zap,
  Calcify: PROFILE.calcify
});
/** Reverse index of the flip pairing: empowered familiar name back to its basic form. */
export const FAMILIAR_BASIC_BY_EMPOWERED = Object.freeze(
  Object.fromEntries(
    Object.entries(FAMILIAR_INTERRUPT_WINDOWS).map(([basic, [empowered]]) => [empowered, basic])
  ) as Readonly<Record<string, string>>
);
