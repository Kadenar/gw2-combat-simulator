import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

import type { MesmerSkillCatalogFragment } from '#gw2/professions/mesmer/data/types.js';

const SHATTER_SKILL_IDS = new Set<number>([
  ID.MIND_WRACK,
  ID.CRY_OF_FRUSTRATION,
  ID.DIVERSION,
  ID.DISTORTION,
  ID.SPLIT_SECOND,
  ID.REWINDER,
  ID.TIME_SINK,
  ID.BLADESONG_HARMONY,
  ID.BLADESONG_SORROW,
  ID.BLADESONG_DISSONANCE,
  ID.BLADESONG_DISTORTION,
  ID.BLADETURN_REQUIEM,
  ID.CONTINUUM_SPLIT
]);

const INSTRUMENT_SKILL_IDS = new Set<number>([
  ID.LIVELY_LUTE,
  ID.LIVELY_LUTE_ALTERNATE,
  ID.FLUSTERING_FLUTE,
  ID.DEAFENING_DRUM,
  ID.HARMONIOUS_HARP,
  ID.HARMONIOUS_HARP_ALTERNATE
]);

/**
 * Assigns handlers only when packet emission itself is runtime-dependent.
 * Fixed effects remain scheduler-owned even when Mesmer's cast hook changes profession state.
 */
export function mesmerHandlerIdFor(skill: MesmerSkillCatalogFragment): string | null {
  const id = Number(skill.id);
  const resource =
    skill.resource && typeof skill.resource === 'object' ? (skill.resource as { readonly mode?: string }) : null;
  if (id === ID.SWAP_WEAPONS) return 'mesmer.weapon-swap';
  if (id === ID.DODGE_MIRAGE_CLOAK) return 'mesmer.mirage-dodge';
  if (id === ID.PICK_UP_MIRAGE_MIRROR) return 'mesmer.mirage-dodge';
  if (id === ID.CONTINUUM_SHIFT) return 'mesmer.continuum-shift';
  if (id === ID.CONTINUUM_SPLIT) return 'mesmer.continuum-split';
  if (SHATTER_SKILL_IDS.has(id)) {
    return id >= ID.BLADETURN_REQUIEM ? 'mesmer.bladesong' : 'mesmer.shatter';
  }

  if (INSTRUMENT_SKILL_IDS.has(id)) return 'mesmer.instrument';
  if (id === ID.CRESCENDO) return 'mesmer.crescendo';
  if (skill.ambush) return 'mesmer.ambush';
  if (id === ID.AXES_OF_SYMMETRY) return 'mesmer.axes-of-symmetry';
  if (skill.phantasm || resource?.mode === 'phantasm') {
    return 'mesmer.phantasm';
  }

  return null;
}

/** Attaches only handlers whose packet emission depends on Mesmer runtime state. */
export function prepareMesmerSkillForCatalog<TSkill extends MesmerSkillCatalogFragment>(skill: TSkill): TSkill {
  const handlerId = mesmerHandlerIdFor(skill);
  return handlerId ? { ...skill, handlerId } : skill;
}
