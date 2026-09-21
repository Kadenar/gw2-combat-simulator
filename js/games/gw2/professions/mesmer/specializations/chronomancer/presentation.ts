import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerResourceViews,
  mesmerUiState
} from '#gw2/professions/mesmer/core/presentation.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import type {
  ProfessionEventLogDescriptor,
  PaletteSkillAvailability,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type { MesmerResolverEvent, MesmerUiContext, MesmerUiSlice } from '#gw2/professions/mesmer/types.js';

const CHRONOMANCER_MECHANIC_SKILLS = Object.freeze([
  ID.SPLIT_SECOND,
  ID.REWINDER,
  ID.TIME_SINK,
  ID.DISTORTION,
  ID.CONTINUUM_SPLIT
]);
const CHRONOMANCER_PALETTE_SKILLS = Object.freeze([...CHRONOMANCER_MECHANIC_SKILLS, ID.CONTINUUM_SHIFT]);

function chronomancerEventLogRow(
  _context: MesmerUiContext,
  event: MesmerResolverEvent
): ProfessionEventLogDescriptor | undefined {
  if (event?.type !== 'mesmer.phantasm-resummoned') return undefined;
  return {
    type: event.type,
    description: `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
    className: 'phantasm',
    order: 21,
    flags: ['phantasm-clone']
  };
}

/** Keeps Continuum Shift unavailable until the active split has produced a restorable snapshot. */
function chronomancerPaletteSkillAvailability(context: MesmerUiContext, skill: Skill): PaletteSkillAvailability {
  if (skill.id !== ID.CONTINUUM_SHIFT) return { available: true, message: '' };
  const state = context.professionState || context.state?.profession || {};
  const available = Boolean(state.continuumActive);
  return {
    available,
    message: available ? '' : 'Unavailable until Continuum Split is active'
  };
}

/** Shows active buff windows and each summoned phantasm's pending clone conversions at the inspected point. */
function chronomancerStateSnapshot(context: MesmerUiContext): RotationStateSnapshotItem[] {
  const state = mesmerUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const result = context.result as Gw2SimulationResult | null | undefined;
  const items: RotationStateSnapshotItem[] = [];
  const continuumRemaining = Number(state.continuumRemaining || 0) / 1000;
  if (state.continuumActive && continuumRemaining > 0) {
    items.push({
      id: 'chronomancer-continuum-split',
      label: 'Continuum Split',
      value: `${continuumRemaining.toFixed(1)}s`,
      title: 'Time remaining before Continuum Split restores its snapshot'
    });
  }

  const dangerTime = timedBuffAt(result, 'danger-time', at);
  if (dangerTime) {
    items.push({
      id: 'chronomancer-danger-time',
      label: 'Danger Time',
      value: `${dangerTime.remaining.toFixed(1)}s`,
      title: 'Danger Time critical-damage window remaining'
    });
  }

  // Read deadlines from the summon event so the display uses the scheduler's timing and ignores future casts.
  const combatStart = Number(result?.events.find((event) => event.type === 'combat_start')?.at || 0);
  for (const event of (result?.events || []) as readonly MesmerResolverEvent[]) {
    if (event.type !== 'mesmer.phantasm-summoned' || event.at > at) continue;
    const pending = (event.conversionTimes || []).filter((conversionAt) => conversionAt > at);
    if (!pending.length) continue;
    items.push({
      id: `chronomancer-phantasm:${event.activationId ?? event.eventOrder}`,
      label: `${event.name} → clone`,
      value: pending.map((conversionAt) => `${(conversionAt - at).toFixed(3)}s`).join(', '),
      title:
        'Time until each phantasm becomes a clone, including any Chronophantasma repeat.\n' +
        `Conversion time: ${pending.map((conversionAt) => `${(conversionAt - combatStart).toFixed(3)}s`).join(', ')}`
    });
  }

  return items;
}

export const chronomancerUi: MesmerUiSlice = Object.freeze({
  eventLogRow: chronomancerEventLogRow,
  rotationStateSnapshot: chronomancerStateSnapshot,
  paletteGroups: (context: MesmerUiContext) =>
    mesmerMechanicPaletteGroups(context, CHRONOMANCER_PALETTE_SKILLS, 'clones').map((group) => ({
      ...group,
      includeActionSkills: true
    })),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'clones',
      singular: 'clone',
      plural: 'clones',
      maximum: 3
    }),
  paletteSkillAvailability: chronomancerPaletteSkillAvailability
});
