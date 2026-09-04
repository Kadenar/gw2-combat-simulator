import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import {
  mesmerMechanicPaletteGroups,
  mesmerMechanicSkillBarGroups,
  mesmerResourceViews
} from '#gw2/professions/mesmer/core/presentation.js';
import type {
  ProfessionEffectPresentation,
  ProfessionEventLogDescriptor,
  ProfessionUiContract
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { MesmerResolverEvent, MesmerUiContext } from '#gw2/professions/mesmer/types.js';

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
  _context: SchedulerRecord,
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

export const troubadourUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  // Altered Chord remains a binary effect when its activation window is refreshed.
  effectPresentations: () => [...TROUBADOUR_EFFECT_PRESENTATIONS],
  eventLogRow: troubadourEventLogRow,
  paletteGroups: (context: MesmerUiContext) =>
    mesmerMechanicPaletteGroups(context, TROUBADOUR_MECHANIC_SKILLS, 'notes'),
  skillBarGroups: () => mesmerMechanicSkillBarGroups('Instruments', TROUBADOUR_MECHANIC_SKILLS),
  resourceViews: (context: MesmerUiContext) => {
    const activeInstruments = (context.professionState as TroubadourUiState | undefined)?.activeInstruments || [];
    const notes = mesmerResourceViews(context, {
      id: 'notes',
      singular: 'note',
      plural: 'notes',
      maximum: 3,
      pipStyle: 'mesmer-notes'
    });
    if (!activeInstruments.length) return notes;
    // Notes remain attached above the instrument row; these unlabeled playing
    // chips are anchored immediately below it to keep the F-key row central.
    return [
      ...notes,
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
