export interface EvtcProfessionMetadata {
  readonly code: number;
  readonly id: string;
  readonly name: string;
}

export interface EvtcSpecializationMetadata {
  readonly code: number;
  readonly id: string;
  readonly name: string;
  readonly professionId: string;
}

const professions: readonly EvtcProfessionMetadata[] = Object.freeze([
  { code: 1, id: "guardian", name: "Guardian" },
  { code: 2, id: "warrior", name: "Warrior" },
  { code: 3, id: "engineer", name: "Engineer" },
  { code: 4, id: "ranger", name: "Ranger" },
  { code: 5, id: "thief", name: "Thief" },
  { code: 6, id: "elementalist", name: "Elementalist" },
  { code: 7, id: "mesmer", name: "Mesmer" },
  { code: 8, id: "necromancer", name: "Necromancer" },
  { code: 9, id: "revenant", name: "Revenant" },
]);

const specializations: readonly EvtcSpecializationMetadata[] = Object.freeze([
  { code: 5, id: "druid", name: "Druid", professionId: "ranger" },
  { code: 7, id: "daredevil", name: "Daredevil", professionId: "thief" },
  { code: 18, id: "berserker", name: "Berserker", professionId: "warrior" },
  {
    code: 27,
    id: "dragonhunter",
    name: "Dragonhunter",
    professionId: "guardian",
  },
  { code: 34, id: "reaper", name: "Reaper", professionId: "necromancer" },
  {
    code: 40,
    id: "chronomancer",
    name: "Chronomancer",
    professionId: "mesmer",
  },
  { code: 43, id: "scrapper", name: "Scrapper", professionId: "engineer" },
  {
    code: 48,
    id: "tempest",
    name: "Tempest",
    professionId: "elementalist",
  },
  { code: 52, id: "herald", name: "Herald", professionId: "revenant" },
  { code: 55, id: "soulbeast", name: "Soulbeast", professionId: "ranger" },
  { code: 56, id: "weaver", name: "Weaver", professionId: "elementalist" },
  {
    code: 57,
    id: "holosmith",
    name: "Holosmith",
    professionId: "engineer",
  },
  { code: 58, id: "deadeye", name: "Deadeye", professionId: "thief" },
  { code: 59, id: "mirage", name: "Mirage", professionId: "mesmer" },
  { code: 60, id: "scourge", name: "Scourge", professionId: "necromancer" },
  {
    code: 61,
    id: "spellbreaker",
    name: "Spellbreaker",
    professionId: "warrior",
  },
  { code: 62, id: "firebrand", name: "Firebrand", professionId: "guardian" },
  { code: 63, id: "renegade", name: "Renegade", professionId: "revenant" },
  {
    code: 64,
    id: "harbinger",
    name: "Harbinger",
    professionId: "necromancer",
  },
  {
    code: 65,
    id: "willbender",
    name: "Willbender",
    professionId: "guardian",
  },
  { code: 66, id: "virtuoso", name: "Virtuoso", professionId: "mesmer" },
  {
    code: 67,
    id: "catalyst",
    name: "Catalyst",
    professionId: "elementalist",
  },
  {
    code: 68,
    id: "bladesworn",
    name: "Bladesworn",
    professionId: "warrior",
  },
  {
    code: 69,
    id: "vindicator",
    name: "Vindicator",
    professionId: "revenant",
  },
  {
    code: 70,
    id: "mechanist",
    name: "Mechanist",
    professionId: "engineer",
  },
  { code: 71, id: "specter", name: "Specter", professionId: "thief" },
  { code: 72, id: "untamed", name: "Untamed", professionId: "ranger" },
  {
    code: 73,
    id: "troubadour",
    name: "Troubadour",
    professionId: "mesmer",
  },
  { code: 74, id: "paragon", name: "Paragon", professionId: "warrior" },
  { code: 75, id: "amalgam", name: "Amalgam", professionId: "engineer" },
  {
    code: 76,
    id: "ritualist",
    name: "Ritualist",
    professionId: "necromancer",
  },
  { code: 77, id: "antiquary", name: "Antiquary", professionId: "thief" },
  { code: 78, id: "galeshot", name: "Galeshot", professionId: "ranger" },
  { code: 79, id: "conduit", name: "Conduit", professionId: "revenant" },
  { code: 80, id: "evoker", name: "Evoker", professionId: "elementalist" },
  { code: 81, id: "luminary", name: "Luminary", professionId: "guardian" },
]);

const professionsByCode = new Map(
  professions.map((profession) => [profession.code, profession]),
);
const specializationsByCode = new Map(
  specializations.map((specialization) => [
    specialization.code,
    specialization,
  ]),
);

export const EVTC_PROFESSIONS = professions;
export const EVTC_SPECIALIZATIONS = specializations;

export function evtcProfessionMetadata(
  code: number,
): EvtcProfessionMetadata | null {
  return professionsByCode.get(code) || null;
}

export function evtcSpecializationMetadata(
  code: number,
  professionId: string,
): Omit<EvtcSpecializationMetadata, "professionId"> | null {
  if (code === 0) return { code: 0, id: "core", name: "Core" };
  const specialization = specializationsByCode.get(code);
  if (!specialization || specialization.professionId !== professionId) {
    return null;
  }
  const { professionId: _professionId, ...metadata } = specialization;
  return metadata;
}
