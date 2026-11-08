/**
 * Defines rotation and palette read types from profession-owned skill fields. Optional fields let catalog skills
 * satisfy these types without casts or additions to the base Skill type.
 */
import type { ProfessionPaletteSkill } from '#gw2/platform/profession-presentation/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Profession concepts the palette groups by and the editor configures. */
export type RotationSkill = Skill &
  Partial<
    Pick<ElementalistSkill, 'attunement'> &
      Pick<MesmerSkill, 'ambush'> &
      Pick<RangerSkill, 'unleashedAmbushSkill'> &
      Pick<ThiefSkill, 'stealthAttack'>
  >;

/**
 * A palette tile: a rotation skill plus the identity the palette attaches. The shell binds hotkeys; Revenant legend
 * destinations share one skill id and stay distinct through their legend.
 */
export type PaletteSkill = ProfessionPaletteSkill<RotationSkill> & {
  readonly hotkeyAction?: string;
  readonly paletteLegendId?: RevenantSkill['paletteLegendId'];
};
