import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import { EQUIPMENT_ICONS } from '#gw2/app/shared/equipment-icons.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { baseBreakdownName } from '#gw2/app/results/skill-breakdown.js';
import {
  ACTION_ICONS,
  MODIFIER_EFFECT_ICONS,
  PLACEHOLDER_ICON,
  RESULT_PROC_NAMES,
  resolveProcIcon,
  resolveRelicIcon
} from '#gw2/app/shared/icons.js';

export interface ResultIconRow {
  readonly name: string;
  readonly id?: unknown;
  readonly sourceSkill?: string;
  readonly parentSkill?: string;
  readonly icon?: string;
  readonly skillId?: SkillId | null;
  readonly sourceId?: SkillId | null;
}

function resolveModifierIcon(row: ResultIconRow): string {
  const id = String(row.id || '');
  const label = String(row.name || '');
  const effectIcon = MODIFIER_EFFECT_ICONS[label];
  if (effectIcon) return effectIcon;

  // Utility contribution rows reuse the selected consumable's equipment icon.
  if (id.startsWith('Utility:')) return EQUIPMENT_ICONS[id.slice('Utility:'.length)] || '';

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

  const breakdownName = baseBreakdownName(row.name);
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
  // Trait damage inherits its triggering skill ID, so use the matching proc's
  // trait icon before that ID can incorrectly select the trigger's icon.
  if (matchingProc?.type === 'trait_proc' && procIcon) return procIcon;

  for (const id of [row.skillId, row.sourceId]) {
    if (id == null) continue;
    const skill = app.skillById?.get(id) || app.skills.find((candidate) => String(candidate.id) === String(id));
    if (skill?.icon) return String(skill.icon);
  }

  const actionIcon = ACTION_ICONS[row.name] || ACTION_ICONS[breakdownName];
  if (actionIcon) return actionIcon;
  const cloneAttackName = breakdownName.startsWith('Clone: ') ? breakdownName.slice('Clone: '.length) : '';
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
