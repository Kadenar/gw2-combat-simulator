import type { PaletteOverride, ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';

const UI_CALLBACK_NAMES = Object.freeze([
  'previewControls',
  'attributePreviewDisabledTrait',
  'prepareAttributePreview',
  'skillDamageGroups',
  'skillDamageState',
  'prepareSkillDamagePreview',
  'chartApplications',
  'timelineMarkers',
  'timelineOverlays',
  'timelineAnnotation',
  'paletteWeaponGroups',
  'paletteSelectedSlotSkills',
  'chargeReleaseProjection',
  'effectPresentations',
  'eventLogRow',
  'isPaletteSkillInstant',
  'paletteOverride',
  'isSlotSkillSelectable',
  'paletteGroups',
  'paletteActionSkills',
  'paletteWeaponSkills',
  'renderWeaponPalette',
  'resolvePaletteAction',
  'resourceViews',
  'skillBarGroups',
  'startControls',
  'targetHealthThresholds',
  'rotationStateSnapshot',
  'timelineWeaponLineTransition',
  'timelineSkillIcon',
  'updatePaletteControl',
  'updateSkillBarSelection'
]);

function assertUiDefinition(ui: UnvalidatedFields): void {
  for (const name of UI_CALLBACK_NAMES) {
    if (ui[name] != null && typeof ui[name] !== 'function') throw new TypeError(`ui.${name} must be a function.`);
  }

  if (ui.assumptionControls != null && !Array.isArray(ui.assumptionControls)) {
    throw new TypeError('ui.assumptionControls must be an array.');
  }

  if (ui.slotLoadout != null && (typeof ui.slotLoadout !== 'object' || Array.isArray(ui.slotLoadout))) {
    throw new TypeError('ui.slotLoadout must be an object.');
  }
}

/** Validate narrow presentation exceptions without inventing a runtime verdict. */
function normalizePaletteOverride(value: unknown, professionId: string): PaletteOverride | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object')
    throw new TypeError(`${professionId} paletteOverride must return an object.`);
  const result = value as UnvalidatedFields;
  for (const key of ['available', 'tileActive', 'editorAccess']) {
    if (result[key] != null && typeof result[key] !== 'boolean')
      throw new TypeError(`${professionId} paletteOverride.${key} must be boolean.`);
  }

  return {
    ...(result.available == null ? {} : { available: result.available as boolean }),
    ...(result.tileActive == null ? {} : { tileActive: result.tileActive as boolean }),
    ...(result.editorAccess == null ? {} : { editorAccess: result.editorAccess as boolean }),
    ...(result.message == null ? {} : { message: String(result.message) })
  };
}

/** Validates and fills display defaults only when the application requests presentation. */
export function normalizeProfessionUi(
  professionId: string,
  ui: Partial<ProfessionUiContract> = {}
): Readonly<ProfessionUiContract> {
  assertUiDefinition(ui);
  // Resource presentation is plural throughout the contract; professions
  // without resource UI normalize directly to an empty collection.
  const resourceViews = ui.resourceViews || (() => []);
  const paletteOverride = ui.paletteOverride;

  const normalizedUi: ProfessionUiContract = {
    ...ui,
    previewControls: ui.previewControls || (() => []),
    attributePreviewDisabledTrait: ui.attributePreviewDisabledTrait || (() => null),
    prepareAttributePreview: ui.prepareAttributePreview || (() => {}),
    // Professions without mechanic groups still list weapons and slot skills through the platform defaults.
    skillDamageGroups: ui.skillDamageGroups || (() => []),
    skillDamageState: ui.skillDamageState || (() => null),
    prepareSkillDamagePreview: ui.prepareSkillDamagePreview || (() => ({})),
    // Empty projections preserve ordinary shared layouts when a profession has no presentation contribution.
    chartApplications: ui.chartApplications || (() => []),
    timelineMarkers: ui.timelineMarkers || (() => []),
    timelineOverlays: ui.timelineOverlays || (() => []),
    timelineAnnotation: ui.timelineAnnotation || (() => null),
    paletteWeaponGroups: ui.paletteWeaponGroups || (() => null),
    paletteSelectedSlotSkills: ui.paletteSelectedSlotSkills || ((_context, skills) => [...skills]),
    assumptionControls: Object.freeze([...(ui.assumptionControls || [])]),
    chargeReleaseProjection: ui.chargeReleaseProjection || (() => null),
    effectPresentations: ui.effectPresentations || (() => []),
    paletteGroups: ui.paletteGroups || (() => []),
    paletteActionSkills: ui.paletteActionSkills || ((_context, skills) => [...skills]),
    paletteWeaponSkills: ui.paletteWeaponSkills || ((_context, skills) => [...skills]),
    renderWeaponPalette: ui.renderWeaponPalette || (() => null),
    resolvePaletteAction: ui.resolvePaletteAction || (() => undefined),
    resourceViews,
    isPaletteSkillInstant: ui.isPaletteSkillInstant || (() => false),
    paletteOverride: paletteOverride
      ? (context, skill) => normalizePaletteOverride(paletteOverride(context, skill), professionId)
      : undefined,
    isSlotSkillSelectable: ui.isSlotSkillSelectable || (() => true),
    skillBarGroups: ui.skillBarGroups || (() => []),
    startControls: ui.startControls || (() => []),
    slotLoadout: ui.slotLoadout || null,
    targetHealthThresholds: ui.targetHealthThresholds || (() => []),
    rotationStateSnapshot: ui.rotationStateSnapshot || (() => []),
    timelineWeaponLineTransition: ui.timelineWeaponLineTransition || (() => undefined),
    timelineSkillIcon: ui.timelineSkillIcon || (() => ''),
    updatePaletteControl: ui.updatePaletteControl || (() => false),
    updateSkillBarSelection: ui.updateSkillBarSelection || (() => false)
  };

  return Object.freeze(normalizedUi);
}
