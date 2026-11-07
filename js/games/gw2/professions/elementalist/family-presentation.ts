/**
 * Supplies Elementalist palette attunement rules and starting-attunement controls. Attunement appears in the
 * palette, so the active-state summary omits it. Specialization modules add their own presentation callbacks.
 * Weaver skips these palette gates because its presentation handles dual attunements.
 */
import { uiSpecialization } from '#gw2/platform/profession-presentation/compose.js';
import type { ProfessionStartControl } from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistSkill,
  ElementalistUiContext,
  ElementalistUiSlice
} from '#gw2/professions/elementalist/types.js';

const ATTUNEMENT_COLORS: Readonly<Record<ElementalistAttunement, string>> = Object.freeze({
  Fire: '#d94c35',
  Water: '#368bc9',
  Air: '#9b65c7',
  Earth: '#a7783f'
});

// Resolves a build's stored attunement choice, falling the secondary back to the
// primary and anything unrecognized back to Fire so controls always have a valid value.
function configuredAttunement(context: ElementalistUiContext, key: 'startAttunement' | 'secondaryAttunement') {
  const build = context.build;
  const value = build?.[key] || (key === 'secondaryAttunement' ? build?.startAttunement : '') || 'Fire';
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

// Builds one start-control dropdown bound to a build field, offering all four
// attunements with their in-game skill icons and the selected element's accent color.
function attunementControl(
  catalog: Readonly<CanonicalCatalog<ElementalistSkill>>,
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

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindElementalistFamilyUi(catalog: Readonly<CanonicalCatalog<ElementalistSkill>>): ElementalistUiSlice {
  return Object.freeze({
    startControls: (context: ElementalistUiContext) =>
      uiSpecialization(context) === 'Weaver'
        ? [
            attunementControl(catalog, context, 'startAttunement', 'Primary attunement'),
            attunementControl(catalog, context, 'secondaryAttunement', 'Secondary attunement')
          ]
        : [attunementControl(catalog, context, 'startAttunement', 'Start attunement')]
  });
}

/** Keeps the shared attunement bank anchored only when an elite does not replace the profession resource slot. */
export function elementalistAttunementResourceAnchor(context: ElementalistUiContext): boolean {
  return ['Core', 'Weaver'].includes(uiSpecialization(context));
}
