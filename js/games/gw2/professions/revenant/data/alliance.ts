/** Alliance factions share utility slots while retaining separate skill identities and cooldowns. */
import type { SkillId } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export type AllianceFaction = 'Luxon' | 'Kurzick';

/** Saved Alliance slots 6 through 10 use these Luxon skill IDs in bar order. */
export const ALLIANCE_SLOT_ROOTS = Object.freeze([
  ID.SELFISH_SPIRIT,
  ID.NOMADS_ADVANCE,
  ID.SCAVENGER_BURST,
  ID.REAVERS_RAGE,
  ID.SPEAR_OF_ARCHEMORUS
]);

interface AllianceSlots {
  readonly kurzickByRoot: ReadonlyMap<SkillId, RevenantSkill>;
  readonly factionBySkill: ReadonlyMap<SkillId, AllianceFaction>;
}

const slotsByCatalog = new WeakMap<ReadonlyMap<SkillId, RevenantSkill>, AllianceSlots>();

/** The five saved slots own the Luxon bar. Each Kurzick replacement and its flip inherit the same control. */
export function allianceSlots(skillsById: ReadonlyMap<SkillId, RevenantSkill>): AllianceSlots {
  const cached = slotsByCatalog.get(skillsById);

  if (cached) return cached;

  const kurzickByRoot = new Map<SkillId, RevenantSkill>();
  const factionBySkill = new Map<SkillId, AllianceFaction>(ALLIANCE_SLOT_ROOTS.map((id) => [id, 'Luxon']));
  for (const skill of skillsById.values()) {
    const root = skill.loadoutSkillId;

    if (skill.legendId !== LEGEND.ALLIANCE || root == null || factionBySkill.get(root) !== 'Luxon') continue;

    if (kurzickByRoot.has(root)) throw new Error(`Alliance slot ${root} has multiple Kurzick replacements.`);

    kurzickByRoot.set(root, skill);
    factionBySkill.set(skill.id, 'Kurzick');

    if (skill.flipSkillId != null) factionBySkill.set(skill.flipSkillId, 'Kurzick');
  }

  for (const root of ALLIANCE_SLOT_ROOTS) {
    if (!skillsById.has(root)) throw new Error(`Alliance slot references missing Luxon skill ${root}.`);

    if (!kurzickByRoot.has(root)) throw new Error(`Alliance slot ${root} has no Kurzick replacement.`);
  }

  const slots = { kurzickByRoot, factionBySkill };
  slotsByCatalog.set(skillsById, slots);
  return slots;
}
