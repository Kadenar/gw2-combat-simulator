import type { SkillId } from '../../../../../../platform/engine/types.js';
import type { ElementalistAttunement } from '../../../core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

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
export const BASIC_FAMILIARS = new Set(['Ignite', 'Splash', 'Zap', 'Calcify']);
export const OFF_ATTUNEMENT_RECHARGE_SECONDS = 1.5;
export const EVOKER_NO_CHARGE_SKILLS = new Set([
  'Transmute Earth',
  'Hurl',
  'Transmute Frost',
  'Transmute Lightning',
  'Transmute Fire',
  'Grand Finale'
]);
export const ELECTRIC_ENCHANTMENT_ICON = 'https://wiki.guildwars2.com/images/7/7b/Hare%27s_Agility.png';
export const CONJURED_WEAPONS = new Set(['Frost Bow', 'Lightning Hammer', 'Fiery Greatsword']);
export const ALTRUISTIC_ASPECT_BOONS: ReadonlyMap<SkillId, readonly [kind: string, stacks: number, duration: number]> =
  new Map([
    [ID.FOXS_FURY, ['Might', 3, 10]],
    [ID.HARES_AGILITY, ['Fury', 1, 5]],
    [ID.TOADS_FORTITUDE, ['Stability', 1, 5]],
    [ID.ELEMENTAL_PROCESSION, ['Resistance', 1, 5]]
  ]);
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
export const FAMILIAR_PROFILE_BY_BASIC: Readonly<Record<string, SkillId>> = Object.freeze({
  Ignite: PROFILE.ignite,
  Splash: PROFILE.splash,
  Zap: PROFILE.zap,
  Calcify: PROFILE.calcify
});
export const FAMILIAR_BASIC_BY_EMPOWERED = Object.freeze(
  Object.fromEntries(
    Object.entries(FAMILIAR_INTERRUPT_WINDOWS).map(([basic, [empowered]]) => [empowered, basic])
  ) as Readonly<Record<string, string>>
);
