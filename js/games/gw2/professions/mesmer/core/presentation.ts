import { mesmerResourceProfileId } from '#gw2/professions/mesmer/family-state.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import type {
  ProfessionEffectPresentation,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  MesmerUiState,
  MesmerResolverEvent,
  MesmerUiContext,
  MesmerUiSlice
} from '#gw2/professions/mesmer/types.js';
import { clamp } from '#kernel/core/numeric.js';

export interface MesmerUiResourceDefinition {
  readonly id: 'blades' | 'notes' | 'clones';
  readonly singular: string;
  readonly plural: string;
  readonly pipStyle?: string;
}

export function mesmerUiSpecialization(context: MesmerUiContext = {}): string {
  return context.specialization || context.config?.specialization || 'Core';
}

export function mesmerUiState(context: MesmerUiContext = {}): MesmerUiState {
  return flattenProfessionState(context.state?.profession || context.professionState) as MesmerUiState;
}

/** Converts the projected millisecond Clarity duration into an active-state timer. */
function mesmerCoreStateSnapshot(context: MesmerUiContext): RotationStateSnapshotItem[] {
  const state = mesmerUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const remaining =
    state.clarityRemaining != null ? Number(state.clarityRemaining || 0) / 1000 : Number(state.clarityUntil || 0) - at;
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
      skillIds: skillIds.filter((id) => context.catalog?.skillsById?.has(id)),
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
  const state = flattenProfessionState(context.state?.profession || context.professionState) as MesmerUiState;
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
      order: 20,
      flags: ['phantasm-clone']
    }),
    'mesmer.phantasm-attack': (event) => ({
      type: event.type,
      description: `PHANTASM DAMAGE COMPLETE ${event.name} x${event.count}` + `${event.repeat ? ' [repeat]' : ''}`,
      className: 'phantasm',
      order: 22,
      flags: ['phantasm-clone']
    })
  });

export function mesmerEventLogRow(
  _context: MesmerUiContext,
  event: MesmerResolverEvent
): ProfessionEventLogDescriptor | undefined {
  const present = MESMER_EVENT_ROWS[event?.type];
  return present ? present(event) : undefined;
}

const CORE_MECHANIC_SKILLS = Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]);

/** Publishes Core Mesmer effect labels, colors, and patch-aware stack caps to result views. */
function mesmerCoreEffectPresentations(context: MesmerUiContext): ProfessionEffectPresentation[] {
  const compoundingPowerProfile = requireBalanceProfileFromContext(context, PROFILE.compoundingPower);
  const fencersFinesseProfile = requireBalanceProfileFromContext(context, PROFILE.fencersFinesse);
  return [
    {
      id: 'mesmer-compounding-power',
      kind: 'compounding',
      name: 'Compounding Power',
      color: '#cfb5ff',
      maximumStacks: balanceProfileNumber(compoundingPowerProfile, 'maximumStacks')
    },
    {
      id: 'mesmer-illusionary-membrane',
      kind: 'illusionary-membrane',
      name: 'Illusionary Membrane',
      color: '#6ec9d8',
      maximumStacks: 1
    },
    {
      id: 'mesmer-fencers-finesse',
      kind: 'fencer',
      name: "Fencer's Finesse",
      color: '#e1c070',
      maximumStacks: balanceProfileNumber(fencersFinesseProfile, 'maximumStacks')
    }
  ];
}

export const mesmerCoreUi: MesmerUiSlice = Object.freeze({
  assumptionControls: [...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS, ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS],
  effectPresentations: mesmerCoreEffectPresentations,
  eventLogRow: mesmerEventLogRow,
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
