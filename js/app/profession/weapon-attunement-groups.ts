import type { Skill } from "../../platform/engine/types.js";

const ATTUNEMENT_ORDER = new Map(
  ["Fire", "Water", "Air", "Earth", "Dual", "Special"].map(
    (attunement, index) => [attunement, index],
  ),
);

export interface WeaponAttunementGroup {
  readonly attunement: string | null;
  readonly skills: Skill[];
}

export interface WeaverWeaponPaletteRow {
  readonly attunement: string;
  readonly skills: Skill[];
}

export interface WeaverWeaponPaletteLayout {
  readonly primaryRows: WeaverWeaponPaletteRow[];
  readonly sameAttunementSkills: Skill[];
  readonly dualSkills: Skill[];
  readonly secondaryRows: WeaverWeaponPaletteRow[];
  readonly extraSkills: Skill[];
}

export function weaponBarSkillStacks(
  skills: readonly Skill[],
  flattenSameSlots = false,
): Skill[][] {
  if (flattenSameSlots) return skills.map((skill) => [skill]);

  const bySlot = new Map<string, Skill[]>();
  for (const skill of skills) {
    const slot = String(skill.slot);
    const stack = bySlot.get(slot) || [];
    stack.push(skill);
    bySlot.set(slot, stack);
  }
  return [...bySlot.values()];
}

/**
 * Splits Elementalist-style weapon variants into one row per attunement.
 * Professions without multiple elemental rows keep the normal single-row bar.
 */
export function groupWeaponSkillsByAttunement(
  skills: readonly Skill[],
  specialization: string,
): WeaponAttunementGroup[] {
  const byAttunement = new Map<string, Skill[]>();
  for (const skill of skills) {
    const skillAttunement = String(skill.attunement || "Special");
    const attunement =
      specialization === "Weaver" && skillAttunement.includes("+")
        ? "Dual"
        : skillAttunement;
    const groupedSkills = byAttunement.get(attunement) || [];
    groupedSkills.push(skill);
    byAttunement.set(attunement, groupedSkills);
  }

  const elementalAttunementCount = [...byAttunement.keys()].filter(
    (attunement) => attunement !== "Special",
  ).length;
  if (elementalAttunementCount < 2) {
    return [{ attunement: null, skills: [...skills] }];
  }

  return [...byAttunement]
    .sort(
      ([left], [right]) =>
        (ATTUNEMENT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (ATTUNEMENT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(([attunement, groupedSkills]) => ({
      attunement,
      skills: groupedSkills,
    }));
}

/**
 * Projects Weaver weapon variants into their fixed combat-bar roles.
 *
 * Elemental skills remain visible in both the primary (1-2) and secondary
 * (4-5) banks. Slot 3 owns both the four same-element skills and every mixed
 * dual attack, preventing those attacks from becoming a fifth wrapping row.
 */
export function weaverWeaponPaletteLayout(
  skills: readonly Skill[],
): WeaverWeaponPaletteLayout {
  const elementalRows = ["Fire", "Water", "Air", "Earth"].map((attunement) => ({
    attunement,
    skills: skills.filter((skill) => skill.attunement === attunement),
  }));
  const slot = (skill: Skill): number =>
    Number(String(skill.slot || "").match(/(\d+)$/)?.[1] || 0);
  const primaryRows = elementalRows.map((row) => ({
    ...row,
    skills: row.skills.filter((skill) => slot(skill) <= 2),
  }));
  const sameAttunementSkills = elementalRows.flatMap((row) =>
    row.skills.filter((skill) => slot(skill) === 3),
  );
  const dualSkills = skills.filter(
    (skill) =>
      slot(skill) === 3 && String(skill.attunement || "").includes("+"),
  );
  const secondaryRows = elementalRows.map((row) => ({
    ...row,
    skills: row.skills.filter((skill) => slot(skill) >= 4),
  }));
  const assigned = new Set(
    [
      ...primaryRows.flatMap((row) => row.skills),
      ...sameAttunementSkills,
      ...dualSkills,
      ...secondaryRows.flatMap((row) => row.skills),
    ].map((skill) => skill.id),
  );

  return {
    primaryRows,
    sameAttunementSkills,
    dualSkills,
    secondaryRows,
    extraSkills: skills.filter((skill) => !assigned.has(skill.id)),
  };
}
