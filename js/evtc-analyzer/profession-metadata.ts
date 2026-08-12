interface ProfessionMetadata {
  readonly id: string;
  readonly name: string;
}

interface SpecializationMetadata {
  readonly id: string;
  readonly name: string;
  readonly professionId: string;
}

const professions = new Map<number, ProfessionMetadata>([
  [1, { id: "guardian", name: "Guardian" }],
  [2, { id: "warrior", name: "Warrior" }],
  [3, { id: "engineer", name: "Engineer" }],
  [4, { id: "ranger", name: "Ranger" }],
  [5, { id: "thief", name: "Thief" }],
  [6, { id: "elementalist", name: "Elementalist" }],
  [7, { id: "mesmer", name: "Mesmer" }],
  [8, { id: "necromancer", name: "Necromancer" }],
  [9, { id: "revenant", name: "Revenant" }],
]);

// IDs are the GW2 API specialization IDs already represented by the
// simulator's generated profession metadata snapshots.
const specializations = new Map<number, SpecializationMetadata>([
  [5, { id: "druid", name: "Druid", professionId: "ranger" }],
  [7, { id: "daredevil", name: "Daredevil", professionId: "thief" }],
  [18, { id: "berserker", name: "Berserker", professionId: "warrior" }],
  [27, { id: "dragonhunter", name: "Dragonhunter", professionId: "guardian" }],
  [34, { id: "reaper", name: "Reaper", professionId: "necromancer" }],
  [40, { id: "chronomancer", name: "Chronomancer", professionId: "mesmer" }],
  [43, { id: "scrapper", name: "Scrapper", professionId: "engineer" }],
  [48, { id: "tempest", name: "Tempest", professionId: "elementalist" }],
  [52, { id: "herald", name: "Herald", professionId: "revenant" }],
  [55, { id: "soulbeast", name: "Soulbeast", professionId: "ranger" }],
  [56, { id: "weaver", name: "Weaver", professionId: "elementalist" }],
  [57, { id: "holosmith", name: "Holosmith", professionId: "engineer" }],
  [58, { id: "deadeye", name: "Deadeye", professionId: "thief" }],
  [59, { id: "mirage", name: "Mirage", professionId: "mesmer" }],
  [60, { id: "scourge", name: "Scourge", professionId: "necromancer" }],
  [61, { id: "spellbreaker", name: "Spellbreaker", professionId: "warrior" }],
  [62, { id: "firebrand", name: "Firebrand", professionId: "guardian" }],
  [63, { id: "renegade", name: "Renegade", professionId: "revenant" }],
  [64, { id: "harbinger", name: "Harbinger", professionId: "necromancer" }],
  [65, { id: "willbender", name: "Willbender", professionId: "guardian" }],
  [66, { id: "virtuoso", name: "Virtuoso", professionId: "mesmer" }],
  [67, { id: "catalyst", name: "Catalyst", professionId: "elementalist" }],
  [68, { id: "bladesworn", name: "Bladesworn", professionId: "warrior" }],
  [69, { id: "vindicator", name: "Vindicator", professionId: "revenant" }],
  [70, { id: "mechanist", name: "Mechanist", professionId: "engineer" }],
  [71, { id: "specter", name: "Specter", professionId: "thief" }],
  [72, { id: "untamed", name: "Untamed", professionId: "ranger" }],
  [73, { id: "troubadour", name: "Troubadour", professionId: "mesmer" }],
  [74, { id: "paragon", name: "Paragon", professionId: "warrior" }],
  [75, { id: "amalgam", name: "Amalgam", professionId: "engineer" }],
  [76, { id: "ritualist", name: "Ritualist", professionId: "necromancer" }],
  [77, { id: "antiquary", name: "Antiquary", professionId: "thief" }],
  [78, { id: "galeshot", name: "Galeshot", professionId: "ranger" }],
  [79, { id: "conduit", name: "Conduit", professionId: "revenant" }],
  [80, { id: "evoker", name: "Evoker", professionId: "elementalist" }],
  [81, { id: "luminary", name: "Luminary", professionId: "guardian" }],
]);

export function professionMetadata(code: number): ProfessionMetadata {
  return professions.get(code) || { id: "unknown", name: `Unknown (${code})` };
}

export function specializationMetadata(
  code: number,
  professionId: string,
): Omit<SpecializationMetadata, "professionId"> {
  if (code === 0) return { id: "core", name: "Core" };
  const specialization = specializations.get(code);
  if (!specialization || specialization.professionId !== professionId) {
    return { id: "unknown", name: `Unknown (${code})` };
  }
  return { id: specialization.id, name: specialization.name };
}
