/**
 * Owns elemental attack identities and their immutable runtime profile selection.
 * Scheduler lifecycle and packet execution live in `runtime.ts`.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';

export type ElementalKind = 'Fire' | 'Earth';
export type ElementalImpact =
  | 'fireball'
  | 'flame-burst'
  | 'flame-barrage-projectile'
  | 'flame-barrage-explosion'
  | 'punch'
  | 'enervating-punch'
  | 'stomp';

export const FLAME_BARRAGE_ID = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage.skillId;
export const STOMP_ID = EARTH_ELEMENTAL_EVTC_PROFILE.stomp.skillId;

/** Converts selected skill names into the one elemental profile the controller should run. */
export function selectedElementalFromSkills(selected: ReadonlySet<string>): ElementalKind | null {
  if (selected.has('Glyph of Elementals (Earth)')) return 'Earth';
  return selected.has('Glyph of Elementals') || selected.has('Glyph of Elementals (Fire)') ? 'Fire' : null;
}

export function elementalForGlyphId(skillId: number | string): ElementalKind | null {
  if (skillId === ID.GLYPH_OF_ELEMENTALS_EARTH) return 'Earth';
  return skillId === ID.GLYPH_OF_ELEMENTALS ? 'Fire' : null;
}

export function elementalCommandName(element: ElementalKind): 'Flame Barrage' | 'Stomp' {
  return element === 'Earth' ? 'Stomp' : 'Flame Barrage';
}

export function elementalRuntimeProfile(element: ElementalKind) {
  return element === 'Earth' ? EARTH_ELEMENTAL_EVTC_PROFILE : FIRE_ELEMENTAL_EVTC_PROFILE;
}
