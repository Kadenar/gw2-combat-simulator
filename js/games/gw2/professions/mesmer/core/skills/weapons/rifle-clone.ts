import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Rifle clones retain their own attack strength, payloads, and cadence independently of player attacks. */
export const rifleCloneAttack = {
  id: ID.FRIENDLY_FIRE,
  coefficient: 0.5,
  hits: 1,
  interval: 1.2,
  weaponStrength: 26.5
} satisfies MesmerCloneAttack;
