import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/catalog.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export const PLACEHOLDER_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';

export const REFRESH_ARROW_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="6" fill="%23232632"/%3E%3Cpath d="M49 21A20 20 0 1 0 52 39" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round"/%3E%3Cpath d="M49 9v13H36" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E';

export const COMBAT_START_ICON = 'https://wiki.guildwars2.com/images/e/e9/Call_Target.png';

// Mushroom King's Blessing reuses Cap Hop's icon in the training area.
export const COOLDOWN_RESET_ICON = 'https://wiki.guildwars2.com/images/8/86/Cap_Hop.png';

export const WAIT_ICON = 'https://wiki.guildwars2.com/images/8/83/%22sipcoffee%22_Emote_Tome.png';

export const ACTION_ICONS: Readonly<Record<string, string>> = {
  Dodge: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
  'Dodge / Mirage Cloak': 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
  'Pick Up Mirage Mirror': 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
  'Mirage Mirror': 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png',
  'Swap Weapons': 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
  'Continuum Shift': 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png'
};

export const RESULT_PROC_NAMES: Readonly<Record<string, string>> = {
  'Phantasmal Blade': 'Phantasmal Blades',
  'Cascading Corruption': 'Meltdown'
};

/** Supplies one canonical icon set for build controls and effect result rows. */
export const MODIFIER_EFFECT_ICONS: Readonly<Record<string, string>> = {
  Might: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Might.png',
  Fury: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fury.png',
  Quickness: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Quickness.png',
  Alacrity: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Alacrity.png',
  Protection: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Protection.png',
  Resolution: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Resolution.png',
  Regeneration: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Regeneration.png',
  Swiftness: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Swiftness.png',
  Vigor: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Vigor.png',
  Aegis: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Aegis.png',
  Burning: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Burning.png',
  Bleeding: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Bleeding.png',
  Torment: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Torment.png',
  Confusion: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Confusion.png',
  Poisoned: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Poisoned.png',
  Vulnerability: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Vulnerability.png',
  Weakness: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Weakness.png',
  Blindness: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Blinded.png',
  Slow: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Slow.png',
  Chilled: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Chilled.png',
  Cripple: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Crippled.png',
  Immobilize: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Immobile.png',
  Fear: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fear.png',
  Taunt: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Taunt.png'
};

export function resolveRelicIcon(label: unknown): string {
  const value = String(label || '');
  const sourceName = value
    .match(/^relic[.:_-](.+)$/i)?.[1]
    ?.replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase();
  const relicData = RELIC_DATA as Readonly<Record<string, SchedulerRecord>>;
  for (const [name, relic] of Object.entries(relicData)) {
    if (
      relic.icon &&
      (value === name ||
        value.startsWith(`Relic of ${name}`) ||
        value.startsWith(`Relic of the ${name}`) ||
        sourceName === name.toLowerCase())
    ) {
      return String(relic.icon);
    }
  }

  return '';
}

export function resolveProcIcon(app: ProfessionAppState, proc: Gw2ProcStep): string {
  if (Number(proc.cooldownReduction) > 0) return REFRESH_ARROW_ICON;
  const traits = app.attributeData?.activeTraits || [];
  const traitIcon = proc.type === 'trait_proc' ? traits.find((trait) => trait.name === proc.skill)?.icon : '';
  const relicIcon = proc.type === 'relic_proc' ? resolveRelicIcon(proc.skill) : '';
  const procSkillIcon = app.skillByName.get(proc.skill)?.icon;
  const sourceIcon = app.skillByName.get(proc.sourceSkill)?.icon;
  return String(proc.icon || traitIcon || relicIcon || procSkillIcon || sourceIcon || '');
}
