import type {
  ElementalistState,
  ElementalistUiContext,
  ElementalistUiSlice
} from '#gw2/professions/elementalist/types.js';
/**
 * Family-level UI contract for the Elementalist.
 *
 * Holds the presentation rules that are true for every Elementalist build regardless of
 * elite specialization: which palette
 * skills the current attunement allows, and the start-attunement build controls.
 * Attunement is shown in the palette, so the active-state summary omits it.
 * Specialization modules contribute their own UI slices on top of this;
 * Weaver opts out of the attunement gates here
 * because its dual-attunement model is owned by the Weaver presentation.
 */
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionStartControl } from '#gw2/platform/profession-presentation/types.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { CONJURED_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';

const ATTUNEMENT_COLORS: Readonly<Record<ElementalistAttunement, string>> = Object.freeze({
  Fire: '#d94c35',
  Water: '#368bc9',
  Air: '#9b65c7',
  Earth: '#a7783f'
});
const ATTUNEMENT_SKILL_IDS = new Set<number>(Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS));

// The elite spec name reaches these callbacks either directly or through the
// simulation config, depending on which shell (build editor or results) is asking.
function specialization(context: ElementalistUiContext): string {
  return String(context.specialization || context.config?.specialization || 'Core');
}

// Reads the profession state from either a live scheduler context or an end-of-run
// result context, so one set of UI rules serves both the editor and the replay view.
function state(context: ElementalistUiContext): Partial<ElementalistState> {
  const live = context.professionState;
  const end = context.state;
  return live || end?.profession || {};
}

// Resolves a build's stored attunement choice, falling the secondary back to the
// primary and anything unrecognized back to Fire so controls always have a valid value.
function configuredAttunement(context: ElementalistUiContext, key: 'startAttunement' | 'secondaryAttunement') {
  const build = context.build;
  const value = String(build?.[key] || (key === 'secondaryAttunement' ? build?.startAttunement : '') || 'Fire');
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

// Builds one start-control dropdown bound to a build field, offering all four
// attunements with their in-game skill icons and the selected element's accent color.
function attunementControl(
  catalog: Readonly<CanonicalCatalog>,
  context: ElementalistUiContext,
  key: 'startAttunement' | 'secondaryAttunement',
  label: string
): ProfessionStartControl {
  const value = configuredAttunement(context, key);
  return {
    label,
    buildKey: key,
    value,
    options: ELEMENTALIST_ATTUNEMENTS.map((attunement) => ({
      value: attunement,
      label: attunement,
      icon: catalog.skillsById.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement])?.icon,
      description: `${attunement} attunement`
    })),
    color: ATTUNEMENT_COLORS[value]
  };
}

// Apply family-level attunement and hammer-orb gates for non-Weavers; Weaver's
// two-hand model is delegated to its specialization UI contract.
function paletteSkillAvailability(context: ElementalistUiContext, skill: Skill) {
  // Keep the standard weapon rows visible but disabled until the wielded conjure is dropped or expires.
  const conjure = state(context).conjureEquipped;
  const weapon = String(skill.skillWeapon || skill.weapon || '');
  // Inactive conjure bars remain visible but cannot queue attacks until their own bundle is wielded.
  if (skill.type === 'Weapon' && CONJURED_WEAPONS.has(weapon) && conjure !== weapon) {
    return { available: false, message: `Equip ${weapon} before using its skills.` };
  }

  if (conjure && skill.type === 'Weapon' && weapon !== conjure) {
    return { available: false, message: `Drop ${String(conjure)} before using normal weapon skills.` };
  }

  if (specialization(context) === 'Weaver') return { available: true, message: '' };
  const primary = String(state(context).primaryAttunement || context.build?.startAttunement || 'Fire');
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
  const carryover = state(context).autoattackCarryover;
  // An autoattack chain carried across an attunement swap may finish in its original
  // element, so its remaining steps stay castable even though they are now off-attunement.
  if (position && carryover?.root === position.root && carryover.attunement === skill.attunement) {
    return { available: true, message: '' };
  }

  const available = skill.attunement === primary;
  return { available, message: available ? '' : `Requires ${String(skill.attunement)} attunement.` };
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindElementalistFamilyUi(catalog: Readonly<CanonicalCatalog>): ElementalistUiSlice {
  return Object.freeze({
    startControls: (context: ElementalistUiContext) =>
      specialization(context) === 'Weaver'
        ? [
            attunementControl(catalog, context, 'startAttunement', 'Primary attunement'),
            attunementControl(catalog, context, 'secondaryAttunement', 'Secondary attunement')
          ]
        : [attunementControl(catalog, context, 'startAttunement', 'Start attunement')],
    paletteSkillAvailability
  });
}

/** Keeps the shared attunement bank anchored only when an elite does not replace the profession resource slot. */
export function elementalistAttunementResourceAnchor(context: ElementalistUiContext): boolean {
  return ['Core', 'Weaver'].includes(specialization(context));
}
