import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import type { ProfessionUiContract, PaletteSkillAvailability } from '#gw2/platform/profession-presentation/types.js';

const UI_CALLBACK_NAMES = Object.freeze([
  'chargeReleaseProjection',
  'effectPresentations',
  'eventLogRow',
  'isPaletteSkillInstant',
  'paletteSkillAvailability',
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

  if (ui.weaponSwapChangesSet != null && typeof ui.weaponSwapChangesSet !== 'boolean') {
    throw new TypeError('ui.weaponSwapChangesSet must be a boolean.');
  }
}

function normalizePaletteAvailability(value: unknown, professionId: string): PaletteSkillAvailability {
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${professionId} paletteSkillAvailability must return an object.`);
  }

  const result = value as UnvalidatedFields;
  if (typeof result.available !== 'boolean') {
    throw new TypeError(`${professionId} paletteSkillAvailability.available must be boolean.`);
  }

  if (result.retryAt != null && !Number.isFinite(Number(result.retryAt))) {
    throw new TypeError(`${professionId} paletteSkillAvailability.retryAt must be a finite number or null.`);
  }

  return {
    available: result.available,
    message: String(result.message || ''),
    ...(result.retryAt == null ? {} : { retryAt: Number(result.retryAt) })
  };
}

/** Validates and fills display defaults only when the application requests presentation. */
export function normalizeProfessionUi(
  professionId: string,
  ui: Partial<ProfessionUiContract> = {}
): Readonly<ProfessionUiContract> {
  assertUiDefinition(ui as UnvalidatedFields);
  // Resource presentation is plural throughout the contract; professions
  // without resource UI normalize directly to an empty collection.
  const resourceViews = ui.resourceViews || (() => []);
  const paletteSkillAvailability = ui.paletteSkillAvailability;

  const normalizedUi: ProfessionUiContract = {
    ...ui,
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
    // Keep availability, its explanation, and retry timing together; missing policies impose no restriction.
    paletteSkillAvailability: paletteSkillAvailability
      ? (context, skill) => normalizePaletteAvailability(paletteSkillAvailability(context, skill), professionId)
      : () => ({ available: true, message: '' }),
    isSlotSkillSelectable: ui.isSlotSkillSelectable || (() => true),
    skillBarGroups: ui.skillBarGroups || (() => []),
    startControls: ui.startControls || (() => []),
    slotLoadout: ui.slotLoadout || null,
    targetHealthThresholds: ui.targetHealthThresholds || (() => []),
    rotationStateSnapshot: ui.rotationStateSnapshot || (() => []),
    timelineWeaponLineTransition: ui.timelineWeaponLineTransition || (() => undefined),
    timelineSkillIcon: ui.timelineSkillIcon || (() => ''),
    updatePaletteControl: ui.updatePaletteControl || (() => false),
    updateSkillBarSelection: ui.updateSkillBarSelection || (() => false),
    weaponSwapChangesSet: ui.weaponSwapChangesSet !== false
  };

  return Object.freeze(normalizedUi);
}
