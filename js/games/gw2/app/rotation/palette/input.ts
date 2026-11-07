/** Captures presentation facts and planning state at the cursor or an explicit drop position. */
import { activeSpecialization, cursorPreview, palettePlanningState } from '#gw2/app/rotation/context.js';
import type { PaletteInput } from '#gw2/app/rotation/palette/model.js';
import { resultCombatReferenceMs } from '#gw2/app/shared/result-clock.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';

export function capturePaletteInput(app: ProfessionAppState, insertionIndex?: number): PaletteInput {
  const { build, activeCatalog: catalog, adapter, profession, patch } = app;
  const specialization = activeSpecialization(app);
  const cursorIndex =
    normalizeRotationInsertionIndex(app.rotationInsertionIndex, build.rotation.length) ?? build.rotation.length;
  // A drop at the cursor can reuse the prefix already calculated for the palette.
  const planning =
    insertionIndex === undefined || insertionIndex === cursorIndex
      ? palettePlanningState(app)
      : (cursorPreview(app).candidate(insertionIndex)?.planningState ?? null);
  const skillTooltip = adapter.skillTooltip;
  return {
    build,
    catalog,
    specialization,
    planning,
    weaponData: app.weaponData,
    isSkillAvailable: adapter.isSkillAvailable,
    weaponSkillMatchesSet: adapter.weaponSkillMatchesSet,
    selectedTraitIds: (app.attributeData?.activeTraits || []).map((trait) => trait.id),
    projectActions: profession.ui.paletteActionSkills,
    ui: profession.ui,
    slotLoadout: adapter.slotLoadout,
    canSwapWeaponSetsInCombat: profession.resolveProfession({ specialization }).canSwapWeaponSetsInCombat,
    // Tooltip labels retain the displayed combat origin even when the cursor precedes combat entry.
    combatReferenceMs: resultCombatReferenceMs(app.analysis.state.results),
    tooltip: (skill) => skillTooltip(skill, patch, build)
  };
}
