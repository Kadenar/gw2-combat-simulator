import type { SchedulerRecord, SkillId } from '../../platform/engine/types.js';
import type { Gw2ProcStep } from '../../platform/gw2/types.js';
import { FOOD_DATA, NOURISHMENT_ICON, RELIC_DATA, SIGIL_DATA } from '../../platform/gw2/gear-data.js';
import type { ProfessionAppState } from '../profession/types.js';

export interface ResultIconRow {
  readonly name: string;
  readonly id?: unknown;
  readonly sourceSkill?: string;
  readonly parentSkill?: string;
  readonly icon?: string;
  readonly skillId?: SkillId | null;
  readonly sourceId?: SkillId | null;
}

export const PLACEHOLDER_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';

export const REFRESH_ARROW_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="6" fill="%23232632"/%3E%3Cpath d="M49 21A20 20 0 1 0 52 39" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round"/%3E%3Cpath d="M49 9v13H36" fill="none" stroke="%23d8c7ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E';

export const COMBAT_START_ICON = 'https://wiki.guildwars2.com/images/e/e9/Call_Target.png';

export const COOLDOWN_RESET_ICON = 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Mistlock_Singularity.png';

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

export const MODIFIER_EFFECT_ICONS: Readonly<Record<string, string>> = {
  Might: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Might.png',
  Fury: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fury.png',
  Vulnerability: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Vulnerability.png'
};

function resolveRelicIcon(label: unknown): string {
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

function resolveModifierIcon(row: ResultIconRow): string {
  const id = String(row.id || '');
  const label = String(row.name || '');
  const effectIcon = MODIFIER_EFFECT_ICONS[label];
  if (effectIcon) return effectIcon;

  const sigilName = id.startsWith('Sigil:') ? id.slice('Sigil:'.length) : label.match(/^Sigil of (.+)$/)?.[1];
  if (sigilName && SIGIL_DATA[sigilName]?.icon) {
    return String(SIGIL_DATA[sigilName]?.icon);
  }

  const foodName = id.startsWith('Food:') ? id.slice('Food:'.length) : label.match(/^Food: (.+)$/)?.[1];
  if (foodName && FOOD_DATA[foodName]?.icon) {
    return String(FOOD_DATA[foodName].icon);
  }
  if (label === 'Nourishment' || label === 'Food: Nourishment') {
    return NOURISHMENT_ICON;
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

export const baseBreakdownName = (name: unknown): string =>
  String(name || '')
    .split('\u2014')[0]
    .trim();

export function resultSkillIcon(app: ProfessionAppState, row: ResultIconRow): string {
  if (row.icon) return String(row.icon);
  // Modifier-contribution rows for traits carry a "Trait:<name>" id. Prefer the
  // trait's own icon; otherwise a matching cooldown-reduction proc below wins
  // and paints the generic refresh-arrow icon instead (e.g. Symbiotic Synergy,
  // Mercurial Tendencies).
  if (String(row.id).startsWith('Trait:')) {
    const traitIcon = (app.attributeData?.activeTraits || []).find((candidate) => candidate.name === row.name)?.icon;
    if (traitIcon) return String(traitIcon);
  }
  for (const id of [row.skillId, row.sourceId]) {
    if (id == null) continue;
    const skill = app.skillById?.get(id) || app.skills.find((candidate) => String(candidate.id) === String(id));
    if (skill?.icon) return String(skill.icon);
  }
  const breakdownName = baseBreakdownName(row.name);
  const actionIcon = ACTION_ICONS[row.name] || ACTION_ICONS[breakdownName];
  if (actionIcon) return actionIcon;
  const cloneAttackName = breakdownName.startsWith('Clone: ') ? breakdownName.slice('Clone: '.length) : '';
  const procNames = new Set(
    [
      row.name,
      row.sourceSkill,
      breakdownName,
      RESULT_PROC_NAMES[row.name],
      row.sourceSkill ? RESULT_PROC_NAMES[row.sourceSkill] : '',
      RESULT_PROC_NAMES[breakdownName]
    ].flatMap((name) => (name ? [String(name)] : []))
  );
  const matchingProc = (app.results?.procSteps || []).find((proc) => procNames.has(proc.skill));
  const procIcon = matchingProc && resolveProcIcon(app, matchingProc);
  if (procIcon) return procIcon;

  const modifierIcon = resolveModifierIcon(row);
  if (modifierIcon) return modifierIcon;

  const traits = app.attributeData?.activeTraits || [];
  const trait = traits.find(
    (candidate) => candidate.name === row.name || candidate.name === breakdownName || row.name.includes(candidate.name)
  );
  if (trait?.icon) return String(trait.icon);

  const relicIcon = resolveRelicIcon(row.name) || resolveRelicIcon(row.sourceSkill) || resolveRelicIcon(row.sourceId);
  if (relicIcon) return relicIcon;

  for (const name of [row.name, row.sourceSkill, row.parentSkill, breakdownName, cloneAttackName]) {
    const icon = name ? app.skillByName.get(name)?.icon : '';
    if (icon) return icon;
  }

  if (row.name.endsWith(' Clone')) {
    const weapon = row.name.slice(0, -' Clone'.length);
    const autoattack = app.skills.find(
      (skill) => skill.type === 'Weapon' && skill.weapon === weapon && String(skill.slot).endsWith('1')
    );
    if (autoattack?.icon) return autoattack.icon;
  }
  return PLACEHOLDER_ICON;
}
