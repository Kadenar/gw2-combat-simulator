import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import type {
  ProfessionEventLogDescriptor,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerResourceViews,
  mesmerUiState
} from '#gw2/professions/mesmer/core/presentation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

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
  if (event.type !== 'mesmer.phantasm-resummoned') return undefined;
  return {
    type: event.type,
    description: `PHANTASM RESUMMONED ${event.name} x${event.count} [Chronophantasma]`,
    className: 'phantasm',
    order: 21
  };
}

/** Shows active buff windows and each summoned phantasm's pending clone conversions at the inspected point. */
function chronomancerStateSnapshot(context: MesmerUiContext): RotationStateSnapshotItem[] {
  const state = mesmerUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const result = context.result;
  const items: RotationStateSnapshotItem[] = [];
  const continuumRemaining = (state.continuumRemaining || 0) / 1000;
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
  const combatStart = result?.events.find((event) => event.type === 'combat_start')?.at || 0;
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
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);

    preview.boon('alacrity', 'Flow of Time');
    preview.buff('Danger Time', 'dangerTime', 'danger-time', 'Critical Damage');
    return preview.controls;
  },

  eventLogRow: chronomancerEventLogRow,
  // Only automatic expiry adds a marker; manually authored Continuum Shift already has a tile.
  timelineMarkers: ({ result }) =>
    (result?.events || [])
      .filter(
        (event) => event.type === 'marker' && event.name === 'Continuum Shift' && event.detail === 'split expired'
      )
      .map((event) => ({
        at: event.at,
        color: '#d6b46b',
        badge: 'AUTO',
        icon: 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png',
        title: (time: string) =>
          ['Continuum Shift', `Continuum Split ended automatically at ${time}`, 'Cooldown state restored'].join('\n')
      })),
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
      plural: 'clones'
    })
});
