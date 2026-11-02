// Browser-facing Mesmer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.ts.
import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { WEAPON } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { mesmerTooltips } from '#gw2/professions/mesmer/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/mesmer/build/context.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Exposes Mesmer only through the shared browser application contract.
export const mesmerAppAdapter = defineProfessionApp({
  tooltips: mesmerTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  storageVersion: 2,
  // Mirage owns ambush skills; Mesmer narrows skill ids, so only the ambush flag is read from its vocabulary.
  isSkillAvailable(skill: Skill & Pick<MesmerSkill, 'ambush'>, { specialization }) {
    return !skill.ambush || specialization === 'Mirage';
  },
  defaultOffhand() {
    return WEAPON.SWORD;
  }
});
