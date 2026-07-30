import {
  NOURISHMENT_ICON,
  RELIC_DATA,
  SIGIL_DATA,
} from "../../platform/gw2/gear-data.js";

export const PLACEHOLDER_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';

export const REFRESH_ARROW_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="6" fill="%23232632"/%3E%3Cpath d="M49 21A20 20 0 1 0 52 39" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round"/%3E%3Cpath d="M49 9v13H36" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E';

export const COMBAT_START_ICON =
  "https://wiki.guildwars2.com/images/e/e9/Call_Target.png";

export const COOLDOWN_RESET_ICON =
  "https://wiki.guildwars2.com/wiki/Special:Redirect/file/Mistlock_Singularity.png";

export const WAIT_ICON =
  "https://wiki.guildwars2.com/images/8/83/%22sipcoffee%22_Emote_Tome.png";

export const VINDICATOR_DODGE_AUTO_ICON =
  "https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png";

export const ACTION_ICONS = {
  Dodge: "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
  "Dodge / Mirage Cloak": "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
  "Swap Weapons":
    "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
  "Continuum Shift":
    "https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png",
};

export const RESULT_PROC_NAMES = {
  "Phantasmal Blade": "Phantasmal Blades",
  "Cascading Corruption": "Meltdown",
};

export const MODIFIER_EFFECT_ICONS = {
  Might: "https://wiki.guildwars2.com/wiki/Special:Redirect/file/Might.png",
  Fury: "https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fury.png",
  Vulnerability:
    "https://wiki.guildwars2.com/wiki/Special:Redirect/file/Vulnerability.png",
};

function resolveRelicIcon(label) {
  const value = String(label || "");
  for (const [name, relic] of Object.entries(RELIC_DATA)) {
    if (
      relic.icon &&
      (value === name ||
        value.startsWith(`Relic of ${name}`) ||
        value.startsWith(`Relic of the ${name}`))
    ) {
      return relic.icon;
    }
  }
  return "";
}

function resolveModifierIcon(row) {
  const id = String(row.id || "");
  const label = String(row.name || "");
  const effectIcon = MODIFIER_EFFECT_ICONS[label];
  if (effectIcon) return effectIcon;

  const sigilName = id.startsWith("Sigil:")
    ? id.slice("Sigil:".length)
    : label.match(/^Sigil of (.+)$/)?.[1];
  if (sigilName && SIGIL_DATA[sigilName]?.icon) {
    return SIGIL_DATA[sigilName].icon;
  }

  if (label === "Nourishment" || label === "Food: Nourishment") {
    return NOURISHMENT_ICON;
  }
  return "";
}

export function resolveProcIcon(app, proc) {
  if (Number(proc.cooldownReduction) > 0) return REFRESH_ARROW_ICON;
  const traits = app.attributeData?.activeTraits || [];
  const traitIcon =
    proc.type === "trait_proc"
      ? traits.find((trait) => trait.name === proc.skill)?.icon
      : "";
  const relicIcon =
    proc.type === "relic_proc" ? resolveRelicIcon(proc.skill) : "";
  const sourceIcon = app.skillByName.get(proc.sourceSkill)?.icon;
  return proc.icon || traitIcon || relicIcon || sourceIcon || "";
}

export const baseBreakdownName = (name) =>
  String(name || "")
    .split("—")[0]
    .trim();

export function resultSkillIcon(app, row) {
  if (row.icon) return row.icon;
  const breakdownName = baseBreakdownName(row.name);
  const cloneAttackName = breakdownName.startsWith("Clone: ")
    ? breakdownName.slice("Clone: ".length)
    : "";
  const procNames = new Set(
    [
      row.name,
      row.sourceSkill,
      breakdownName,
      RESULT_PROC_NAMES[row.name],
      RESULT_PROC_NAMES[row.sourceSkill],
      RESULT_PROC_NAMES[breakdownName],
    ].filter(Boolean),
  );
  const matchingProc = (app.results?.procSteps || []).find((proc) =>
    procNames.has(proc.skill),
  );
  const procIcon = matchingProc && resolveProcIcon(app, matchingProc);
  if (procIcon) return procIcon;

  const modifierIcon = resolveModifierIcon(row);
  if (modifierIcon) return modifierIcon;

  const traits = app.attributeData?.activeTraits || [];
  const trait = traits.find(
    (candidate) =>
      candidate.name === row.name ||
      candidate.name === breakdownName ||
      row.name.includes(candidate.name),
  );
  if (trait?.icon) return trait.icon;

  const relicIcon = resolveRelicIcon(row.name);
  if (relicIcon) return relicIcon;

  for (const name of [
    row.name,
    row.sourceSkill,
    row.parentSkill,
    breakdownName,
    cloneAttackName,
  ]) {
    const icon = app.skillByName.get(name)?.icon;
    if (icon) return icon;
  }

  if (row.name.endsWith(" Clone")) {
    const weapon = row.name.slice(0, -" Clone".length);
    const autoattack = app.skills.find(
      (skill) =>
        skill.type === "Weapon" &&
        skill.weapon === weapon &&
        String(skill.slot).endsWith("1"),
    );
    if (autoattack?.icon) return autoattack.icon;
  }
  return PLACEHOLDER_ICON;
}
