import type { SkillId } from '#gw2/platform/engine/skills/types.js';
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

/** Converts selected skill IDs into the one elemental profile the controller should run. */
export function selectedElementalFromSkills(selected: ReadonlySet<SkillId>): ElementalKind | null {
  if (selected.has(ID.GLYPH_OF_ELEMENTALS_EARTH)) return 'Earth';
  return selected.has(ID.GLYPH_OF_ELEMENTALS) ? 'Fire' : null;
}

export function elementalForGlyphId(skillId: number | string): ElementalKind | null {
  if (skillId === ID.GLYPH_OF_ELEMENTALS_EARTH) return 'Earth';
  return skillId === ID.GLYPH_OF_ELEMENTALS ? 'Fire' : null;
}

export function elementalRuntimeProfile(element: ElementalKind) {
  return element === 'Earth' ? EARTH_ELEMENTAL_EVTC_PROFILE : FIRE_ELEMENTAL_EVTC_PROFILE;
}
