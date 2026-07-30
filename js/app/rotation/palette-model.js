import { defaultWeaponSkillMatchesSet } from "../../platform/gw2/weapon-skill-matcher.js";
import {
  paletteView,
} from "../../platform/ui/palette.js";
import {
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  VINDICATOR_DODGE_AUTO_ICON,
  WAIT_ICON,
} from "./icons.js";
import { activeSpecialization, professionEndState } from "./context.js";

export const VINDICATOR_DODGE_AUTO_ACTION = "__vindicator_dodge_auto";

const PALETTE_ACTION_ORDER = new Map([
  ["Dodge", 0],
  ["Dodge / Mirage Cloak", 0],
  ["Swap Weapons", 1],
]);

export function uniqueByName(skills) {
  const unique = new Map();
  for (const skill of skills) {
    if (!unique.has(skill.name)) unique.set(skill.name, skill);
  }
  return [...unique.values()];
}

export function weaponSkills(app, weaponSet = 1) {
  const [mh, oh] =
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
      )
        return false;
      return (
        app.adapter.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet
      )(skill, [mh, oh], {
        build: app.build,
        specialization: activeSpecialization(app),
        professionState: app.results?.endState?.profession,
        catalog:
          app.profession?.catalog || app.adapter?.profession?.catalog || null,
        weaponData: app.weaponData,
        weaponSet,
      });
    }),
  ).sort((a, b) => {
    const slotOrder = String(a.slot).localeCompare(String(b.slot));
    if (slotOrder) return slotOrder;
    if (a.flipSkillId === b.id) return -1;
    if (b.flipSkillId === a.id) return 1;
    const chainOrder =
      Number(a.chainStep ?? Number.MAX_SAFE_INTEGER) -
      Number(b.chainStep ?? Number.MAX_SAFE_INTEGER);
    return chainOrder || 0;
  });
}

export function weaponPaletteRows(app, activeWeaponSet = 1) {
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

export function weaponPaletteStackHtml(groups = []) {
  const content = groups.filter(Boolean).join("");
  if (!content) return "";
  return (
    `<div class="weapon-palette-stack" data-role="weapon-set-stack" ` +
    `style="display:flex;flex-direction:column;align-items:stretch;gap:6px">${content}</div>`
  );
}

export function weaponPaletteSectionHtml(
  weaponGroups = [],
  actionGroup = "",
  trailingGroup = "",
) {
  const weapons = weaponPaletteStackHtml(weaponGroups);
  if (!weapons && !actionGroup && !trailingGroup) return "";
  return (
    `<div class="weapon-palette-section" data-role="weapon-palette-section" ` +
    `style="display:flex;align-items:flex-start;gap:6px">` +
    `${weapons}${actionGroup}${trailingGroup}</div>`
  );
}

export function autoattackChainSkillAvailable(skill, chainState = {}) {
  if (!skill.chainRoot) return true;
  const expected = chainState[skill.chainRoot] ?? skill.chainRoot;
  return skill.name === expected || skill.id === Number(expected);
}

export function currentAutoattackSkill(app) {
  const activeWeaponSet = Number(
    app.results?.endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
  );
  const chainState = app.results?.endState?.profession?.autoattackChains || {};
  return (
    weaponSkills(app, activeWeaponSet).find(
      (skill) =>
        skill.slot === "Weapon_1" &&
        !skill.ambush &&
        autoattackChainSkillAvailable(skill, chainState),
    ) || null
  );
}

export function vindicatorDodgeAutoRotationEntries(app, offsetMs = 0) {
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

export function appendVindicatorDodgeAuto(app, offsetMs = 0) {
  const entries = vindicatorDodgeAutoRotationEntries(app, offsetMs);
  if (!entries.length) return false;
  app.build.rotation.push(...entries);
  app.changed(false);
  return true;
}

export function vindicatorDodgeAutoPaletteSkill(app, specialization) {
  if (specialization !== "Vindicator" || !currentAutoattackSkill(app)) {
    return null;
  }
  return {
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
  app,
  specialization = activeSpecialization(app),
) {
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

export function rotationPaletteGroups(app, context) {
  return paletteView(app.profession, context);
}

export function rotationLoadoutPaletteGroups(app, context) {
  return app.adapter.slotLoadout?.paletteGroups(context) || [];
}

export function rotationSelectedSlotSkills(app) {
  if (app.adapter.slotLoadout) return [];
  return Object.values(app.build.selectedSkills)
    .map((name) => app.skillByName.get(name))
    .filter(Boolean);
}

export function rotationUtilityFlipByParent(app) {
  const skillById = app.skillById || app.profession.catalog.skillsById;
  return new Map(
    app.skills
      .filter(
        (skill) =>
          (skill.flipParent || skill.flipParentId != null) &&
          skill.type !== "Weapon" &&
          !skill.kit &&
          skill.paletteFlip !== false,
      )
      .flatMap((skill) => {
        const parentName =
          skill.flipParent || skillById.get(Number(skill.flipParentId))?.name;
        return parentName ? [[parentName, skill]] : [];
      }),
  );
}

export function paletteSkillIsInstant(app, context, skill, name = skill?.name) {
  return (
    name === "__combat_start" ||
    name === "__cooldown_reset" ||
    Number(skill?.castTimeMs || 0) === 0 ||
    app.profession.ui.isPaletteSkillInstant?.(context, skill) === true
  );
}
