import { defaultWeaponSkillMatchesSet } from '../../platform/gw2/equipment/weapons/skill-matcher.js';
import type {
  CanonicalCatalog,
  ProfessionStartControl,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  Skill
} from '../../platform/engine/types.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from './data/ids.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from './core/state.js';

const ATTUNEMENT_COLORS: Readonly<Record<ElementalistAttunement, string>> = Object.freeze({
  Fire: '#d94c35',
  Water: '#368bc9',
  Air: '#9b65c7',
  Earth: '#a7783f'
});
const ATTUNEMENT_SKILL_IDS = new Set<number>(Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS));
let elementalistCatalog: Readonly<CanonicalCatalog> | undefined;

function specialization(context: SchedulerRecord): string {
  return String(context.specialization || (context.config as SchedulerRecord | undefined)?.specialization || 'Core');
}

function state(context: SchedulerRecord): SchedulerRecord {
  const live = context.professionState as SchedulerRecord | undefined;
  const end = context.state as { profession?: SchedulerRecord } | undefined;
  return live || end?.profession || {};
}

function configuredAttunement(context: SchedulerRecord, key: 'startAttunement' | 'secondaryAttunement') {
  const build = context.build as SchedulerRecord | undefined;
  const value = String(build?.[key] || (key === 'secondaryAttunement' ? build?.startAttunement : '') || 'Fire');
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

function attunementControl(
  context: SchedulerRecord,
  key: 'startAttunement' | 'secondaryAttunement',
  label: string
): ProfessionStartControl {
  const value = configuredAttunement(context, key);
  return {
    id: `elementalist-${key}`,
    label,
    buildKey: key,
    value,
    options: ELEMENTALIST_ATTUNEMENTS.map((attunement) => ({
      value: attunement,
      label: attunement,
      icon: elementalistCatalog?.skillsById.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement])?.icon,
      description: `${attunement} attunement`
    })),
    color: ATTUNEMENT_COLORS[value]
  };
}

/** Selects specialization-specific weapon identities at the Elementalist family boundary. */
function weaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[],
  context: SchedulerRecord
): boolean {
  if (state(context).conjureEquipped) return false;
  if (String(skill.attunement || '').includes('+') && specialization(context) !== 'Weaver') return false;
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}

// Apply family-level attunement and hammer-orb gates for non-Weavers; Weaver's
// two-hand model is delegated to its specialization UI contract.
function paletteSkillAvailability(context: SchedulerRecord, skill: Skill) {
  if (specialization(context) === 'Weaver') return { available: true, message: '' };
  const primary = String(
    state(context).primaryAttunement || (context.build as SchedulerRecord | undefined)?.startAttunement || 'Fire'
  );
  if (ATTUNEMENT_SKILL_IDS.has(Number(skill.id))) {
    const target = skill.name.replace(/ Attunement$/, '');
    return target === primary
      ? { available: false, message: `Already attuned to ${target}.` }
      : { available: true, message: '' };
  }

  if (skill.type !== 'Weapon' || !skill.attunement) return { available: true, message: '' };
  const catalog = context.catalog as Readonly<CanonicalCatalog> | undefined;
  const position = catalog?.autoattackChainPositions.get(Number(skill.id));
  const carryover = state(context).autoattackCarryover as SchedulerRecord | undefined;
  if (position && carryover?.root === position.root && carryover.attunement === skill.attunement) {
    return { available: true, message: '' };
  }

  const available = skill.attunement === primary;
  return { available, message: available ? '' : `Requires ${String(skill.attunement)} attunement.` };
}

function rotationStateSnapshot(context: SchedulerRecord): RotationStateSnapshotItem[] {
  if (specialization(context) === 'Weaver') return [];
  const current = state(context);
  return [
    {
      id: 'elementalist-attunement',
      label: 'Attunement',
      value: String(current.primaryAttunement || 'Fire')
    }
  ];
}

export const elementalistFamilyUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  weaponSkillMatchesSet,
  startControls: (context: SchedulerRecord) =>
    specialization(context) === 'Weaver'
      ? [
          attunementControl(context, 'startAttunement', 'Primary attunement'),
          attunementControl(context, 'secondaryAttunement', 'Secondary attunement')
        ]
      : [attunementControl(context, 'startAttunement', 'Start attunement')],
  paletteSkillAvailability,
  rotationStateSnapshot
});

/** Shares the assembled catalog with family controls without rebuilding profession data. */
export function bindElementalistFamilyUiCatalog(catalog: Readonly<CanonicalCatalog>): void {
  elementalistCatalog = catalog;
}

/** Keeps the shared attunement bank anchored only when an elite does not replace the profession resource slot. */
export function elementalistAttunementResourceAnchor(context: SchedulerRecord): boolean {
  return ['Core', 'Weaver'].includes(specialization(context));
}
