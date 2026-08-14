import type { Skill, SkillId } from "../platform/engine/types.js";
import type { ProfessionAppState } from "../app/profession/types.js";
import {
  paletteActionSkills,
  rotationLoadoutPaletteGroups,
  rotationPaletteGroups,
  rotationSelectedSlotSkills,
  rotationUtilityFlipByParent,
  weaponSkills,
} from "../app/rotation/palette-model.js";
import {
  activeSpecialization,
  paletteEndState,
  paletteProfessionState,
} from "../app/rotation/context.js";
import type { RotationOptimizerCandidate } from "./types.js";

export function skillHasDeclaredDamage(skill: Skill): boolean {
  return (skill.effects || []).some((effect) => {
    if (effect.type === "strike") {
      return (
        Number(effect.coefficient || 0) > 0 ||
        Number(effect.hits || 0) > 0 ||
        Boolean(effect.ticks?.length)
      );
    }
    if (effect.type !== "condition") return false;
    return (
      (Number(effect.stacks || 0) > 0 && Number(effect.duration || 0) > 0) ||
      Boolean(effect.ticks?.length)
    );
  });
}

function groupSkillIds(
  groups: readonly {
    readonly skillIds?: readonly SkillId[];
    readonly reservedSkillIds?: readonly number[];
    readonly skillEntries?: readonly Readonly<Record<string, unknown>>[];
  }[],
): SkillId[] {
  return groups.flatMap((group) => [
    ...(group.skillIds || []),
    ...(group.reservedSkillIds || []),
    ...(group.skillEntries || []).flatMap((entry) =>
      entry.skillId == null ? [] : [entry.skillId as SkillId],
    ),
  ]);
}

/**
 * Enumerates every build-reachable action without relying on rendered palette
 * markup. Runtime legality remains the scheduler's responsibility.
 */
export function enumerateRotationOptimizerCandidates(
  app: ProfessionAppState,
): RotationOptimizerCandidate[] {
  const specialization = activeSpecialization(app);
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const context = {
    specialization,
    catalog: app.profession.catalog,
    professionState,
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet:
      endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000,
    build: app.build,
  };
  const byId = new Map<SkillId, Skill>();
  const weaponSetsById = new Map<SkillId, Set<number>>();
  const add = (skill: Skill | null | undefined): void => {
    if (
      !skill ||
      skill.implemented === false ||
      skill.simulatorExcluded === true ||
      skill.optimizerExcluded === true ||
      byId.has(skill.id)
    ) {
      return;
    }
    byId.set(skill.id, skill);
  };
  const addId = (id: SkillId): void => add(app.skillById.get(id));
  const addWeaponSkill = (skill: Skill, weaponSet: number): void => {
    add(skill);
    const sets = weaponSetsById.get(skill.id) || new Set<number>();
    sets.add(weaponSet);
    weaponSetsById.set(skill.id, sets);
  };

  weaponSkills(app, 1).forEach((skill) => addWeaponSkill(skill, 1));
  weaponSkills(app, 2).forEach((skill) => addWeaponSkill(skill, 2));
  rotationSelectedSlotSkills(app).forEach(add);
  Object.values(app.build.selectedSkills).forEach((name) =>
    add(app.skillByName.get(name)),
  );

  const flipByParent = rotationUtilityFlipByParent(app);
  for (const selected of [...byId.values()]) {
    const visited = new Set<SkillId>();
    let flip = flipByParent.get(selected.name);
    while (flip && !visited.has(flip.id)) {
      add(flip);
      visited.add(flip.id);
      flip = flipByParent.get(flip.name);
    }
  }

  groupSkillIds(rotationPaletteGroups(app, context)).forEach(addId);
  groupSkillIds(rotationLoadoutPaletteGroups(app, context)).forEach(addId);
  paletteActionSkills(app, specialization).forEach(add);

  return [...byId.values()]
    .map((skill) => {
      const declaredDamage = skillHasDeclaredDamage(skill);
      const requiredWeaponSets = skill.requiredMainHand
        ? ([1, 2] as const).filter((weaponSet) => {
            const mainHand =
              weaponSet === 1
                ? app.build.weapons?.[0]
                : app.build.alternateWeapons?.[0];
            return mainHand === skill.requiredMainHand;
          })
        : null;
      return {
        skillId: skill.id,
        name: skill.name,
        declaredDamage,
        potentialEnabler: !declaredDamage,
        priorityEnabler:
          skill.name === "Swap Weapons" || skill.name === "Swap Legends",
        weaponSets:
          requiredWeaponSets ??
          (weaponSetsById.has(skill.id)
            ? [...(weaponSetsById.get(skill.id) || [])]
            : undefined),
      };
    })
    .sort(
      (left, right) =>
        Number(right.declaredDamage) - Number(left.declaredDamage) ||
        left.name.localeCompare(right.name),
    );
}
