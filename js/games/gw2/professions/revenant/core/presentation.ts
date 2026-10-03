import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { REVENANT_ASSUMPTION_CONTROLS } from '#gw2/professions/revenant/build/assumptions.js';
import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { getActiveTraits } from '#gw2/professions/revenant/data/traits-data.js';
import { revenantLegend, revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import type {
  ProfessionStateSnapshotContext,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { RevenantState, RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';

export function revenantUiState(context: RevenantUiContext = {}): Partial<RevenantState> {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

export function activeRevenantLegend(context: RevenantUiContext = {}): string {
  return revenantUiState(context).activeLegendId || context.build?.startingLegend || '';
}

/** Shows the whole Energy unit used by Charged Mists while retaining fractional Energy internally. */
function displayedRevenantEnergy(value: unknown): number {
  const energy = Number(value || 0);
  return Number.isFinite(energy) ? Math.max(0, Math.floor(energy)) : 0;
}

function rotationEntryName(entry: unknown, context: RevenantUiContext): string {
  // Timeline icon projection resolves canonical skill IDs through the active catalog.
  if (!entry || typeof entry !== 'object' || !('type' in entry)) return '';
  if (entry.type !== 'cast' || !('skillId' in entry)) return String(entry.type || '');
  const skillId = entry.skillId;
  const catalog = context.catalog;
  const skillsById = catalog?.skillsById;
  return skillsById instanceof Map ? String(skillsById.get(skillId)?.name || skillId) : String(skillId);
}

// Select the timeline icon from the currently active legend, falling back safely
// when projected runtime state is incomplete.
function revenantTimelineSkillIcon(context: RevenantUiContext = {}): string {
  const skill = context.skill;
  if (skill?.name !== 'Swap Legends') return '';
  const selected = context.build?.selectedLegends || [];
  if (selected.length !== 2) return '';
  const startingIndex = Math.max(0, selected.indexOf(context.build?.startingLegend || ''));
  const priorSwaps = (context.rotation || [])
    .slice(0, Math.max(0, context.index || 0))
    .filter((entry) => rotationEntryName(entry, context) === 'Swap Legends').length;
  const destination = selected[(startingIndex + priorSwaps + 1) % 2];
  return revenantLegend(destination || '')?.icon || '';
}

/** Reports shared Revenant drains and spear charges that directly constrain the next action. */
function revenantCoreStateSnapshot(
  context: RevenantUiContext & Pick<ProfessionStateSnapshotContext, 'balanceContext'>
): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  const upkeeps = state.activeUpkeeps || [];
  const drain = upkeeps.reduce((total, upkeep) => total + Math.max(0, upkeep.upkeepCost || 0), 0);
  if (drain > 0) {
    items.push({
      id: 'revenant-upkeep-drain',
      label: 'Upkeep Drain',
      value: `-${drain}/s`,
      title: `Total energy drain from ${upkeeps.length} active upkeep${upkeeps.length === 1 ? '' : 's'}`
    });
  }

  const abyssExpiries = (state.crushingAbyss || []).map(Number).filter((expiry) => expiry > at);
  if (abyssExpiries.length) {
    // Match runtime acquisition's cap from the selected spear skill.
    const maximum = Math.max(
      0,
      Number(context.balanceContext.catalog.skillsById.get(SKILL.ABYSSAL_RAZE)?.maximumStacks || 0)
    );
    const nextExpiry = Math.min(...abyssExpiries) - at;
    items.push({
      id: 'revenant-crushing-abyss',
      label: 'Crushing Abyss',
      value: `${Math.min(maximum, abyssExpiries.length)}/${maximum} · ${nextExpiry.toFixed(1)}s`,
      title: 'Active charges and time until the next charge expires'
    });
  }

  return items;
}

/** Core presentation reads the current legend and resource projection without a catalog binding. */
export const revenantCoreUi: RevenantUiSlice = Object.freeze({
  // Applications remain separate from damage totals and preserve the runtime's empowered pulse flag.
  chartApplications: ({ result }) =>
    (result?.resolvedEvents || [])
      .filter((event) => event.type === 'condition' && event.skillId === SKILL.EMBRACE_THE_DARKNESS)
      .map((event) => ({
        series: 'Embrace the Darkness',
        at: event.at,
        label: event.name || 'Embrace the Darkness — Torment',
        empowered: event.metadata?.trigger === 'empowered-upkeep-pulse'
      })),
  // Refresh the weapon row at this profession's transformation boundary.
  timelineWeaponLineTransition: (context: RevenantUiContext) =>
    context.skill && [SKILL.SWAP_LEGENDS].some((id) => id === context.skill!.id)
      ? (context.weaponLine ?? null)
      : undefined,

  paletteOverride: (context, skill) => {
    // Legend destinations share one runtime command, but the active destination cannot be selected again.
    if (skill.paletteLegendId === activeRevenantLegend(context))
      return { available: false, message: `${skill.displayName || 'Legend'} is already active` };
  },
  assumptionControls: Object.freeze([
    ...REVENANT_ASSUMPTION_CONTROLS,
    ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
    ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS
  ]),
  targetHealthThresholds: (context: RevenantUiContext = {}) => {
    const traits = getActiveTraits(context.build?.specializations || []);
    return traits.some((trait) => trait.name === 'Swift Termination') ? [0.5] : [];
  },
  slotLoadout: revenantLegendLoadout,
  rotationStateSnapshot: revenantCoreStateSnapshot,
  timelineSkillIcon: revenantTimelineSkillIcon,
  paletteGroups: (context: RevenantUiContext) => {
    const loadout = revenantLegendLoadout.view(context);
    const activeLegend = activeRevenantLegend(context);
    const destination = loadout.bars.find((legend) => legend.id !== activeLegend);

    return [
      {
        id: 'revenant-profession',
        label: 'F',
        skillIds: [SKILL.ANCIENT_ECHO],
        // The F1 tile always invokes the other selected legend; after swapping,
        // the previous legend becomes this same tile's destination.
        skillEntries: destination
          ? [
              {
                skillId: -4,
                displayName: destination.compactLabel,
                icon: revenantLegend(destination.id)?.icon || '',
                paletteLegendId: destination.id
              }
            ]
          : [],
        color: '#a84f54',
        className: 'revenant-f-skills',
        resourceAnchor: true
      }
    ];
  },
  resourceViews: (context: RevenantUiContext) => {
    const state = revenantUiState(context);
    return [
      {
        id: 'energy',
        singular: 'energy',
        plural: 'energy',
        maximum: 100,
        value: displayedRevenantEnergy(state.energy?.value ?? context.initialEnergy ?? 50),
        startMaximum: 100,
        canStart: true,
        buildKey: 'initialEnergy' as const,
        step: 1,
        displayMode: 'bar',
        pipStyle: 'compact-profession-resource-revenant-energy',
        shortLabel: 'E',
        statusLabel: 'Current'
      }
    ];
  }
});
