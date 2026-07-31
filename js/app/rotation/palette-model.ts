import type {
  LegacyRotationItem,
  ProfessionPaletteGroup,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import { defaultWeaponSkillMatchesSet } from "../../platform/gw2/weapon-skill-matcher.js";
import { paletteView } from "../../platform/ui/palette.js";
import type { NormalizedPaletteGroup } from "../../platform/ui/types.js";
import type {
  ProfessionAppState,
  ProfessionSlotLoadoutContext,
} from "../profession/types.js";
import { activeSpecialization } from "./context.js";
import { VINDICATOR_DODGE_AUTO_ICON } from "./icons.js";

export const VINDICATOR_DODGE_AUTO_ACTION = "__vindicator_dodge_auto";

const PALETTE_ACTION_ORDER = new Map<string, number>([
  ["Dodge", 0],
  ["Dodge / Mirage Cloak", 0],
  ["Swap Weapons", 1],
]);

export function uniqueByName(skills: readonly Skill[]): Skill[] {
  const unique = new Map<string, Skill>();
  for (const skill of skills) {
    if (!unique.has(skill.name)) unique.set(skill.name, skill);
  }
  return [...unique.values()];
}

export function weaponSkills(app: ProfessionAppState, weaponSet = 1): Skill[] {
  const [mainHand, offHand] =
    weaponSet === 2 ? app.build.alternateWeapons : app.build.weapons;
  return uniqueByName(
    app.skills.filter((skill) => {
      // Temporary bars and supplemental effects are exposed by profession
      // palette groups, never as skills on an equipped weapon set.
      if (skill.type !== "Weapon" || !skill.weapon) return false;
      if (
        !app.adapter.isSkillAvailable(skill, {
          build: app.build,
          specialization: activeSpecialization(app),
        })
      ) {
        return false;
      }
      return (
        app.adapter.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet
      )(skill, [mainHand, offHand], {
        build: app.build,
        specialization: activeSpecialization(app),
        professionState: app.results?.endState?.profession,
        catalog:
          app.profession?.catalog || app.adapter?.profession?.catalog || null,
        weaponData: app.weaponData,
        weaponSet,
      });
    }),
  ).sort((left, right) => {
    const slotOrder = String(left.slot).localeCompare(String(right.slot));
    if (slotOrder) return slotOrder;
    if (left.flipSkillId === right.id) return -1;
    if (right.flipSkillId === left.id) return 1;
    const chainOrder =
      Number(left.chainStep ?? Number.MAX_SAFE_INTEGER) -
      Number(right.chainStep ?? Number.MAX_SAFE_INTEGER);
    return chainOrder || 0;
  });
}

export interface WeaponPaletteRow {
  readonly id: string;
  readonly label: string;
  readonly weaponSet: number;
  readonly active: boolean;
  readonly skills: Skill[];
}

export function weaponPaletteRows(
  app: ProfessionAppState,
  activeWeaponSet = 1,
): WeaponPaletteRow[] {
  return [1, 2]
    .map((weaponSet) => ({
      id: `weapon-set-${weaponSet}`,
      label: `W${weaponSet}`,
      weaponSet,
      active: weaponSet === activeWeaponSet,
      skills: weaponSkills(app, weaponSet),
    }))
    .filter((row) => row.skills.length);
}

export function weaponPaletteStackHtml(groups: readonly string[] = []): string {
  const content = groups.filter(Boolean).join("");
  if (!content) return "";
  return (
    `<div class="weapon-palette-stack" data-role="weapon-set-stack" ` +
    `style="display:flex;flex-direction:column;align-items:stretch;gap:6px">${content}</div>`
  );
}

export function weaponPaletteSectionHtml(
  weaponGroups: readonly string[] = [],
  actionGroup = "",
  trailingGroup = "",
): string {
  const weapons = weaponPaletteStackHtml(weaponGroups);
  if (!weapons && !actionGroup && !trailingGroup) return "";
  return (
    `<div class="weapon-palette-section" data-role="weapon-palette-section" ` +
    `style="display:flex;align-items:flex-start;gap:6px">` +
    `${weapons}${actionGroup}${trailingGroup}</div>`
  );
}

export function autoattackChainSkillAvailable(
  skill: Skill,
  chainState: SchedulerRecord = {},
): boolean {
  if (!skill.chainRoot) return true;
  const chainRoot = String(skill.chainRoot);
  const expected = chainState[chainRoot] ?? skill.chainRoot;
  return skill.name === expected || skill.id === Number(expected);
}

export function currentAutoattackSkill(app: ProfessionAppState): Skill | null {
  const activeWeaponSet = Number(
    app.results?.endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
  );
  const professionValue = app.results?.endState?.profession;
  const professionState =
    professionValue && typeof professionValue === "object"
      ? (professionValue as SchedulerRecord)
      : {};
  const autoattackChains = professionState.autoattackChains;
  const chainState =
    autoattackChains && typeof autoattackChains === "object"
      ? (autoattackChains as SchedulerRecord)
      : {};
  return (
    weaponSkills(app, activeWeaponSet).find(
      (skill) =>
        skill.slot === "Weapon_1" &&
        !skill.ambush &&
        autoattackChainSkillAvailable(skill, chainState),
    ) || null
  );
}

export function vindicatorDodgeAutoRotationEntries(
  app: ProfessionAppState,
  offsetMs = 0,
): LegacyRotationItem[] {
  const autoattack = currentAutoattackSkill(app);
  if (!autoattack) return [];
  return [
    {
      name: autoattack.name,
      skillId: autoattack.id,
    },
    {
      name: "Dodge",
      skillId: app.skillByName.get("Dodge")?.id,
      offset: Math.max(0, Math.round(Number(offsetMs) || 0)),
    },
  ];
}

export function appendVindicatorDodgeAuto(
  app: ProfessionAppState,
  offsetMs = 0,
): boolean {
  const entries = vindicatorDodgeAutoRotationEntries(app, offsetMs);
  if (!entries.length) return false;
  app.build.rotation.push(...entries);
  app.changed(false);
  return true;
}

export function vindicatorDodgeAutoPaletteSkill(
  app: ProfessionAppState,
  specialization: string,
): Skill | null {
  if (specialization !== "Vindicator" || !currentAutoattackSkill(app)) {
    return null;
  }
  return {
    id: VINDICATOR_DODGE_AUTO_ACTION,
    name: VINDICATOR_DODGE_AUTO_ACTION,
    displayName: "Dodge + Auto",
    description:
      "Cast the current auto-chain step and one Dodge at the same time.",
    icon: VINDICATOR_DODGE_AUTO_ICON,
    type: "Action",
    slot: "Action",
    castTimeMs: 0,
  };
}

export function paletteActionSkills(
  app: ProfessionAppState,
  specialization = activeSpecialization(app),
): Skill[] {
  return uniqueByName(
    app.skills.filter(
      (skill) =>
        skill.type === "Action" &&
        // Shared actions are simulator-owned records. Positive API/Wiki IDs
        // classified as Action are usually trait procs, bundles, or encounter
        // skills and require an explicit opt-in before entering the palette.
        (Number(skill.id) < 0 || skill.paletteAction === true) &&
        skill.name !== "Continuum Shift" &&
        (skill.name !== "Swap Weapons" ||
          app.profession.ui?.weaponSwapChangesSet === false ||
          Boolean(app.build.alternateWeapons?.[0])) &&
        (!skill.specialization || skill.specialization === specialization) &&
        app.adapter.isSkillAvailable(skill, {
          build: app.build,
          specialization,
          professionState: app.results?.endState?.profession,
        }),
    ),
  ).sort(
    (left, right) =>
      (PALETTE_ACTION_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER) -
        (PALETTE_ACTION_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name),
  );
}

export function rotationPaletteGroups(
  app: ProfessionAppState,
  context: SchedulerRecord,
): NormalizedPaletteGroup[] {
  return paletteView(app.profession, context);
}

export function rotationLoadoutPaletteGroups(
  app: ProfessionAppState,
  context: ProfessionSlotLoadoutContext,
): ProfessionPaletteGroup[] {
  return app.adapter.slotLoadout?.paletteGroups(context) || [];
}

export function rotationSelectedSlotSkills(app: ProfessionAppState): Skill[] {
  if (app.adapter.slotLoadout) return [];
  return Object.values(app.build.selectedSkills).flatMap((name) => {
    const skill = app.skillByName.get(name);
    return skill ? [skill] : [];
  });
}

export function rotationUtilityFlipByParent(
  app: ProfessionAppState,
): Map<string, Skill> {
  const skillById = app.skillById || app.profession.catalog.skillsById;
  const flips = new Map<string, Skill>();
  for (const skill of app.skills) {
    if (
      !(skill.flipParent || skill.flipParentId != null) ||
      skill.type === "Weapon" ||
      skill.kit ||
      skill.paletteFlip === false
    ) {
      continue;
    }
    const parentName = String(
      skill.flipParent || skillById.get(Number(skill.flipParentId))?.name || "",
    );
    if (parentName) flips.set(parentName, skill);
  }
  return flips;
}

export function paletteSkillIsInstant(
  app: ProfessionAppState,
  context: SchedulerRecord,
  skill: Skill | null | undefined,
  name = skill?.name || "",
): boolean {
  return (
    name === "__combat_start" ||
    name === "__cooldown_reset" ||
    Number(skill?.castTimeMs || 0) === 0 ||
    (skill != null &&
      app.profession.ui.isPaletteSkillInstant?.(context, skill) === true)
  );
}
