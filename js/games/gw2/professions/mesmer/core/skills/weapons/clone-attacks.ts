import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { axeCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/axe-clone.js';
import { daggerCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/dagger-clone.js';
import { greatswordCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/greatsword-clone.js';
import { rifleCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/rifle-clone.js';
import { scepterCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/scepter-clone.js';
import { spearCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/spear-clone.js';
import { staffCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/staff-clone.js';
import { swordCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/sword-clone.js';

/** Shared clone execution selects weapon-owned data without importing weapon execution modules. */
export const MESMER_CORE_CLONE_ATTACKS: Readonly<Record<string, MesmerCloneAttack>> = Object.freeze({
  Axe: axeCloneAttack,
  Dagger: daggerCloneAttack,
  Greatsword: greatswordCloneAttack,
  Rifle: rifleCloneAttack,
  Scepter: scepterCloneAttack,
  Spear: spearCloneAttack,
  Staff: staffCloneAttack,
  Sword: swordCloneAttack
});
