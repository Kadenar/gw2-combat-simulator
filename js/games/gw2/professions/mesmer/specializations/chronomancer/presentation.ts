import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerMechanicSkillBarGroups,
  mesmerResourceViews,
  mesmerUiState
} from '#gw2/professions/mesmer/core/presentation.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import type {
  ProfessionEventLogDescriptor,
  PaletteSkillAvailability,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  Skill
} from '#gw2/platform/engine/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type { MesmerResolverEvent, MesmerUiContext } from '#gw2/professions/mesmer/types.js';

const CHRONOMANCER_MECHANIC_SKILLS = Object.freeze([
  ID.SPLIT_SECOND,
  ID.REWINDER,
  ID.TIME_SINK,
  ID.DISTORTION,
  ID.CONTINUUM_SPLIT
]);
const CHRONOMANCER_PALETTE_SKILLS = Object.freeze([...CHRONOMANCER_MECHANIC_SKILLS, ID.CONTINUUM_SHIFT]);

function chronomancerEventLogRow(
  _context: SchedulerRecord,
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
  const state = (context.professionState || context.state?.profession || {}) as SchedulerRecord;
  const available = Boolean(state.continuumActive);
  return {
    available,
    message: available ? '' : 'Unavailable until Continuum Split is active'
  };
}

/** Shows the active Continuum Split and Danger Time windows at the inspected rotation point. */
function chronomancerStateSnapshot(context: MesmerUiContext): RotationStateSnapshotItem[] {
  const state = mesmerUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
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

  const dangerTime = timedBuffAt(context.result as Gw2SimulationResult | null | undefined, 'danger-time', at);
  if (dangerTime) {
    items.push({
      id: 'chronomancer-danger-time',
      label: 'Danger Time',
      value: `${dangerTime.remaining.toFixed(1)}s`,
      title: 'Danger Time critical-damage window remaining'
    });
  }

  return items;
}

export const chronomancerUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: chronomancerEventLogRow,
  rotationStateSnapshot: chronomancerStateSnapshot,
  paletteGroups: (context: MesmerUiContext) =>
    mesmerMechanicPaletteGroups(context, CHRONOMANCER_PALETTE_SKILLS, 'clones').map((group) => ({
      ...group,
      includeActionSkills: true
    })),
  skillBarGroups: () => mesmerMechanicSkillBarGroups('Shatters', CHRONOMANCER_MECHANIC_SKILLS),
  resourceViews: (context: MesmerUiContext) =>
    mesmerResourceViews(context, {
      id: 'clones',
      singular: 'clone',
      plural: 'clones',
      maximum: 3
    }),
  paletteSkillAvailability: chronomancerPaletteSkillAvailability
});
