/**
 * Family-level UI contract for the Elementalist.
 *
 * Holds the presentation rules that are true for every Elementalist build regardless of
 * elite specialization: which weapon skills belong to the equipped set, which palette
 * skills the current attunement allows, the start-attunement build controls, and the
 * attunement row shown in rotation state snapshots. Specialization modules contribute
 * their own UI slices on top of this; Weaver opts out of the attunement gates here
 * because its dual-attunement model is owned by the Weaver presentation.
 */
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type {
  CanonicalCatalog,
  ProfessionStartControl,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  Skill
} from '#gw2/platform/engine/types.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/content/professions/elementalist/data/ids.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement
} from '#gw2/content/professions/elementalist/core/state.js';

const ATTUNEMENT_COLORS: Readonly<Record<ElementalistAttunement, string>> = Object.freeze({
  Fire: '#d94c35',
  Water: '#368bc9',
  Air: '#9b65c7',
  Earth: '#a7783f'
});
const ATTUNEMENT_SKILL_IDS = new Set<number>(Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS));
// Populated once by bindElementalistFamilyUiCatalog so start controls can look up
// attunement icons without this module importing (and rebuilding) the catalog.
let elementalistCatalog: Readonly<CanonicalCatalog> | undefined;

// The elite spec name reaches these callbacks either directly or through the
// simulation config, depending on which shell (build editor or results) is asking.
function specialization(context: SchedulerRecord): string {
  return String(context.specialization || (context.config as SchedulerRecord | undefined)?.specialization || 'Core');
}

// Reads the profession state from either a live scheduler context or an end-of-run
// result context, so one set of UI rules serves both the editor and the replay view.
function state(context: SchedulerRecord): SchedulerRecord {
  const live = context.professionState as SchedulerRecord | undefined;
  const end = context.state as { profession?: SchedulerRecord } | undefined;
  return live || end?.profession || {};
}

// Resolves a build's stored attunement choice, falling the secondary back to the
// primary and anything unrecognized back to Fire so controls always have a valid value.
function configuredAttunement(context: SchedulerRecord, key: 'startAttunement' | 'secondaryAttunement') {
  const build = context.build as SchedulerRecord | undefined;
  const value = String(build?.[key] || (key === 'secondaryAttunement' ? build?.startAttunement : '') || 'Fire');
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

// Builds one start-control dropdown bound to a build field, offering all four
// attunements with their in-game skill icons and the selected element's accent color.
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
  // A held conjure bundle replaces the weapon bar, so no equipped-set skill matches.
  if (state(context).conjureEquipped) return false;
  // Dual-attunement ("Fire+Air") skills exist in the shared catalog but only Weaver has them.
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
  // Attuning to the element you are already in is the one attunement swap that is denied.
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
  // An autoattack chain carried across an attunement swap may finish in its original
  // element, so its remaining steps stay castable even though they are now off-attunement.
  if (position && carryover?.root === position.root && carryover.attunement === skill.attunement) {
    return { available: true, message: '' };
  }

  const available = skill.attunement === primary;
  return { available, message: available ? '' : `Requires ${String(skill.attunement)} attunement.` };
}

// Surfaces the current attunement as a rotation-timeline state row; Weaver publishes
// its own dual-attunement row instead.
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

/**
 * The Elementalist family's slice of the profession UI contract, applied under every
 * specialization. Weaver additionally exposes a secondary-attunement start control.
 */
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
