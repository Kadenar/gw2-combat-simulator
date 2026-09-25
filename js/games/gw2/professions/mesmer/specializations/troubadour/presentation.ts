import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerResourceViews,
  mesmerUiState
} from '#gw2/professions/mesmer/core/presentation.js';
import type {
  ProfessionEffectPresentation,
  ProfessionEventLogDescriptor
} from '#gw2/platform/profession-presentation/types.js';
import type { MesmerResolverEvent, MesmerUiContext, MesmerUiSlice } from '#gw2/professions/mesmer/types.js';

interface TroubadourUiState {
  readonly activeInstruments?: readonly {
    readonly name: string;
    readonly remaining: number;
  }[];
}

const TROUBADOUR_MECHANIC_SKILLS = Object.freeze([
  ID.LIVELY_LUTE,
  ID.FLUSTERING_FLUTE,
  ID.DEAFENING_DRUM,
  ID.HARMONIOUS_HARP_ALTERNATE,
  ID.CRESCENDO
]);
const TROUBADOUR_EFFECT_PRESENTATIONS: readonly ProfessionEffectPresentation[] = Object.freeze([
  {
    id: 'mesmer-altered-chord',
    kind: 'altered-chord',
    name: 'Altered Chord',
    color: '#80bce8',
    maximumStacks: 1
  }
]);

function troubadourEventLogRow(
  _context: MesmerUiContext,
  event: MesmerResolverEvent
): ProfessionEventLogDescriptor | undefined {
  if (event?.type !== 'mesmer.instrument') return undefined;
  return {
    type: 'trigger',
    description:
      `INSTRUMENT ${event.instrument}` + `${event.expiresAt ? ` until ${Number(event.expiresAt).toFixed(3)}s` : ''}`,
    className: 'trigger',
    order: 55,
    flags: []
  };
}

export const troubadourUi: MesmerUiSlice = Object.freeze({
  // Altered Chord remains a binary effect when its activation window is refreshed.
  effectPresentations: () => [...TROUBADOUR_EFFECT_PRESENTATIONS],
  eventLogRow: troubadourEventLogRow,
  paletteGroups: (context: MesmerUiContext) =>
    mesmerMechanicPaletteGroups(context, TROUBADOUR_MECHANIC_SKILLS, 'notes'),
  resourceViews: (context: MesmerUiContext) => {
    const activeInstruments = (context.professionState as TroubadourUiState | undefined)?.activeInstruments || [];
    const resources = [
      ...mesmerResourceViews(context, {
        id: 'notes',
        singular: 'note',
        plural: 'notes',
        pipStyle: 'mesmer-notes'
      }),
      // Display the live continuous pool beside Dodge, independently of the instrument notes.
      {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        maximum: context.resources!.endurance!.maximum,
        value: Number(mesmerUiState(context).endurance ?? 100),
        canStart: false,
        step: 1,
        displayMode: 'bar' as const,
        pipStyle: 'endurance',
        shortLabel: 'End',
        statusLabel: 'Current',
        paletteSkillId: ID.DODGE_TROUBADOUR
      }
    ];
    if (!activeInstruments.length) return resources;
    // Notes remain attached above the instrument row; these unlabeled playing
    // chips are anchored immediately below it to keep the F-key row central.
    return [
      ...resources,
      {
        id: 'playing-instruments',
        singular: 'instrument',
        plural: 'instruments',
        maximum: 1,
        value: 0,
        canStart: false,
        shortLabel: 'Playing',
        statusLabel: 'Playing',
        displayMode: 'status',
        statusItems: activeInstruments.map((instrument) => {
          const remaining = `${(instrument.remaining / 1000).toFixed(1)}s`;
          return {
            id: instrument.name.toLowerCase(),
            label: instrument.name,
            valueLabel: remaining,
            title: `${instrument.name} playing — ${remaining} remaining`
          };
        }),
        showValue: false
      }
    ];
  }
});
