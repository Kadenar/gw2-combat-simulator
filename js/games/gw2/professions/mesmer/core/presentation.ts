import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionEffectPresentation,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerResourceProfileId } from '#gw2/professions/mesmer/family-state.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import type { SkillDamagePreviewPreparation } from '#gw2/platform/profession-presentation/skill-damage.js';
import type {
  MesmerResolverEvent,
  MesmerUiContext,
  MesmerUiSlice,
  MesmerUiState
} from '#gw2/professions/mesmer/types.js';
import { clamp } from '#kernel/core/numeric.js';

interface MesmerUiResourceDefinition {
  readonly id: 'blades' | 'notes' | 'clones';
  readonly singular: string;
  readonly plural: string;
  readonly pipStyle?: string;
}

function mesmerUiSpecialization(context: MesmerUiContext = {}): string {
  return context.specialization || context.config?.specialization || 'Core';
}

export function mesmerUiState(context: MesmerUiContext = {}): MesmerUiState {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

/** Converts the projected millisecond Clarity duration into an active-state timer. */
function mesmerCoreStateSnapshot(context: MesmerUiContext): RotationStateSnapshotItem[] {
  const state = mesmerUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const remaining =
    state.clarityRemaining != null ? (state.clarityRemaining || 0) / 1000 : (state.clarityUntil || 0) - at;
  return remaining > 0
    ? [
        {
          id: 'mesmer-clarity',
          label: 'Clarity',
          value: `${remaining.toFixed(1)}s`,
          title: 'Time remaining to consume Clarity'
        }
      ]
    : [];
}

export function mesmerMechanicPaletteGroups(
  context: MesmerUiContext,
  skillIds: readonly SkillId[],
  resourceId?: MesmerUiResourceDefinition['id']
): ProfessionPaletteGroup[] {
  return [
    {
      id: 'profession',
      label: 'Profession',
      skillIds: skillIds.filter((id) => context.catalog?.skillsById.has(id)),
      resourceAnchor: true,
      // Keep the blades/clones/notes pips directly above the shatter/instrument
      // skills rather than tucked underneath them.
      ...(resourceId ? { resourceIds: [resourceId], resourcePlacement: 'above' as const } : {})
    }
  ];
}

export function mesmerResourceViews(
  context: MesmerUiContext,
  definition: MesmerUiResourceDefinition
): ProfessionResourceView[] {
  const state: MesmerUiState = flattenProfessionState(context.state?.profession || context.professionState);
  // Palette pips use the same selected capacity as runtime resource spending.
  const specialization = definition.id === 'blades' ? 'Virtuoso' : definition.id === 'notes' ? 'Troubadour' : 'Core';
  const maximum = balanceProfileNumber(
    requireBalanceProfileFromContext(context, mesmerResourceProfileId(specialization)),
    'maximumStacks'
  );
  const value =
    definition.id === 'clones'
      ? Number(state.clones?.length ?? state.resource ?? context.value ?? 0)
      : Number(state.numericResource || context.value || 0);
  return [
    {
      ...definition,
      maximum,
      value: clamp(value, 0, maximum),
      canStart: definition.id !== 'clones',
      shortLabel: definition.id === 'clones' ? 'Cln' : definition.singular.slice(0, 3),
      statusLabel: definition.id === 'clones' ? 'Active' : 'Current',
      // The three clone pips already communicate the exact count without a
      // redundant numeric label; other Mesmer resources retain their value.
      showValue: definition.id !== 'clones'
    }
  ];
}

const MESMER_EVENT_ROWS: Readonly<Record<string, (event: MesmerResolverEvent) => ProfessionEventLogDescriptor>> =
  Object.freeze({
    'mesmer.phantasm-summoned': (event) => ({
      type: event.type,
      description: `PHANTASM SUMMONED ${event.name} x${event.count}`,
      className: 'phantasm',
      order: 20
    }),
    'mesmer.phantasm-attack': (event) => ({
      type: event.type,
      description: `PHANTASM DAMAGE COMPLETE ${event.name} x${event.count}` + (event.repeat ? ' [repeat]' : ''),
      className: 'phantasm',
      order: 22
    })
  });

function mesmerEventLogRow(
  _context: MesmerUiContext,
  event: MesmerResolverEvent
): ProfessionEventLogDescriptor | undefined {
  const present = MESMER_EVENT_ROWS[event.type];
  return present ? present(event) : undefined;
}

const CORE_MECHANIC_SKILLS = Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]);

/** Publishes Core Mesmer effect labels, colors, and patch-aware stack caps to result views. */
function mesmerCoreEffectPresentations(_context: MesmerUiContext): ProfessionEffectPresentation[] {
  return [
    {
      id: 'mesmer-compounding-power',
      kind: 'compounding',
      name: 'Compounding Power',
      color: '#cfb5ff'
    },
    {
      id: 'mesmer-illusionary-membrane',
      kind: 'illusionary-membrane',
      name: 'Illusionary Membrane',
      color: '#6ec9d8'
    },
    {
      id: 'mesmer-fencers-finesse',
      kind: 'fencer',
      name: "Fencer's Finesse",
      color: '#e1c070'
    }
  ];
}

export const mesmerCoreUi: MesmerUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);

    // Every specialization seeds its existing resource owner; shatters and instruments spend it normally.
    const resource = mesmerResourceDefinition(context.specialization, context);
    preview.add({
      key: 'initialResource',
      label: `Starting ${resource.plural}`,
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      max: resource.maximum,
      // Simulation starts clone-owning builds empty; the detached control can still explore populated shatters.
      initial:
        resource.plural === 'clones'
          ? 0
          : Number((context.build as { readonly initialResource?: unknown }).initialResource) || 0,
      description: `${resource.plural} before setup; resource gains and spending follow the runtime`
    });

    preview.boon('regeneration', 'Chaotic Persistence');
    preview.buff("Fencer's Finesse", 'fencer', 'fencer', 'Ferocity', true);
    preview.targetHealth('Superiority Complex');
    preview.passives('Signet of Domination', 'Signet of Midnight');
    return preview.controls;
  },
  /** Keep starting clones, blades or notes detached from the saved build and the Attribute Preview. */
  prepareSkillDamagePreview: ({ values }: SkillDamagePreviewPreparation) =>
    values.initialResource == null ? {} : { initialResource: Number(values.initialResource) },

  assumptionControls: [...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS, ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS],
  effectPresentations: mesmerCoreEffectPresentations,
  eventLogRow: mesmerEventLogRow,
  // Shatter badges describe the executed resource and its profession-owned spend phase.
  timelineAnnotation: ({ spend }) => {
    if (!spend) return null;
    const labels: Record<string, { singular: string; short: string; phase: string }> = {
      clones: { singular: 'clone', short: 'C', phase: 'cast start' },
      blades: { singular: 'blade', short: 'B', phase: 'cast end' },
      notes: { singular: 'note', short: 'N', phase: 'cast end' }
    };
    const label = labels[spend.resource];
    if (!label) return null;
    return {
      resourceLabel: `${spend.count} ${spend.count === 1 ? label.singular : spend.resource} consumed at ${label.phase}`,
      resourceShortLabel: `${spend.count}${label.short}`
    };
  },
  rotationStateSnapshot: mesmerCoreStateSnapshot,
  paletteGroups: (context: MesmerUiContext) =>
    mesmerUiSpecialization(context) === 'Core'
      ? mesmerMechanicPaletteGroups(context, CORE_MECHANIC_SKILLS, 'clones')
      : [],
  resourceViews: (context: MesmerUiContext) =>
    mesmerUiSpecialization(context) === 'Core'
      ? mesmerResourceViews(context, {
          id: 'clones',
          singular: 'clone',
          plural: 'clones'
        })
      : []
});
