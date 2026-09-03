import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import {
  MESMER_FLIP_CHILD_BY_PARENT_ID,
  MESMER_FLIP_PARENT_BY_CHILD_ID
} from '#gw2/professions/mesmer/core/mechanics/runtime.js';

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

export { MESMER_FLIP_CHILD_BY_PARENT_ID, MESMER_FLIP_PARENT_BY_CHILD_ID };

const FLIP_SKILL_IDS = new Set<number>([
  ...Object.keys(MESMER_FLIP_PARENT_BY_CHILD_ID).map(Number),
  ...Object.values(MESMER_FLIP_PARENT_BY_CHILD_ID)
]);

const SPECIAL_PROFILE_SKILL_IDS = new Set<number>([
  ID.CONFUSING_IMAGES,
  ID.SPATIAL_SURGE,
  ID.MIND_SPIKE,
  ID.FLYING_CUTTER,
  ID.TROUBADOUR_AXES_OF_SYMMETRY,
  ID.MIND_THE_GAP,
  ID.IMAGINARY_INVERSION,
  ID.MENTAL_COLLAPSE,
  ID.SAND_THROUGH_GLASS,
  ID.ILLUSIONARY_AMBUSH,
  ID.SIGNET_OF_DOMINATION,
  ID.SIGNET_OF_MIDNIGHT,
  ID.SIGNET_OF_HUMILITY,
  ID.SIGNET_OF_THE_ETHER,
  ID.SIGNET_OF_ILLUSIONS
]);

/**
 * Selects a stable handler family using IDs and mechanic metadata only.
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
  if (skill.phantasm || resource?.mode === 'phantasm') {
    return 'mesmer.phantasm';
  }

  if (FLIP_SKILL_IDS.has(id)) return 'mesmer.flip';
  if (id === ID.FLYING_CUTTER) return 'mesmer.tracked-hits';
  if (skill.resource) return 'mesmer.resource-skill';
  if (
    SPECIAL_PROFILE_SKILL_IDS.has(id) ||
    skill.type === 'Heal' ||
    skill.weapon === 'Sword' ||
    skill.pulseCount ||
    skill.boonlessCoefficient ||
    skill.maxCloneEffects ||
    (skill.effects || []).some((effect) => effect.requiredTrait || effect.castProgress != null || effect.packetLabel)
  ) {
    return 'mesmer.special-profile';
  }

  return (skill.effects || []).length ? 'mesmer.declarative' : null;
}

/**
 * Moves replacing profiles out of the shared effect list while retaining the
 * accepted legacy profile as handler-owned Mesmer data.
 */
export function prepareMesmerSkillForCatalog<TSkill extends MesmerSkillCatalogFragment>(skill: TSkill): TSkill {
  const handlerId = mesmerHandlerIdFor(skill);
  const flipParentId = MESMER_FLIP_PARENT_BY_CHILD_ID[Number(skill.id)];
  const flipChildId = MESMER_FLIP_CHILD_BY_PARENT_ID[Number(skill.id)];
  const mechanic =
    flipParentId || flipChildId
      ? {
          ...(skill.mesmerMechanic && typeof skill.mesmerMechanic === 'object' ? skill.mesmerMechanic : {}),
          ...(flipParentId ? { flipParentId } : {}),
          ...(flipChildId ? { flipChildId } : {})
        }
      : skill.mesmerMechanic;
  const prepared: TSkill = mechanic ? { ...skill, mesmerMechanic: mechanic } : skill;
  if (!handlerId) return prepared;
  if (handlerId === 'mesmer.declarative') {
    return { ...prepared, handlerId };
  }

  return {
    ...prepared,
    handlerId,
    mesmerEffects: skill.effects || [],
    effects: []
  };
}
