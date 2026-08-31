import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/app/simulation/randomness.js';
import { REVENANT_ASSUMPTION_CONTROLS } from '#gw2/content/professions/revenant/app/assumptions.js';
import { REVENANT_SKILL_IDS as SKILL } from '#gw2/content/professions/revenant/data/ids.js';
import { getActiveTraits } from '#gw2/content/professions/revenant/data/traits-data.js';
import { revenantLegend, revenantLegendLoadout } from '#gw2/content/professions/revenant/app/legend-loadout.js';
import { effectiveRevenantEnergyCost } from '#gw2/content/professions/revenant/energy.js';
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord
} from '#gw2/platform/engine/types.js';
import type {
  RevenantResolverEvent,
  RevenantSkill,
  RevenantState,
  RevenantUiContext
} from '#gw2/content/professions/revenant/types.js';

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

function effectiveEnergyCost(context: RevenantUiContext, skill: RevenantSkill): number {
  return effectiveRevenantEnergyCost(
    {
      ...context,
      professionState: revenantUiState(context)
    },
    skill
  );
}

function rotationEntryName(entry: unknown, context: RevenantUiContext): string {
  // Timeline icon projection resolves canonical skill IDs through the active catalog.
  if (!entry || typeof entry !== 'object' || !('type' in entry)) return '';
  if (entry.type !== 'cast' || !('skillId' in entry)) return String(entry.type || '');
  const skillId = entry.skillId;
  const catalog = context.catalog as SchedulerRecord | undefined;
  const skillsById = catalog?.skillsById;
  return skillsById instanceof Map ? String(skillsById.get(skillId)?.name || skillId) : String(skillId);
}

// Select the timeline icon from the currently active legend, falling back safely
// when projected runtime state is incomplete.
export function revenantTimelineSkillIcon(context: RevenantUiContext = {}): string {
  const skill = context.skill as RevenantSkill | undefined;
  if (skill?.name !== 'Swap Legends') return '';
  const selected = context.build?.selectedLegends || [];
  if (selected.length !== 2) return '';
  const startingIndex = Math.max(0, selected.indexOf(context.build?.startingLegend || ''));
  const priorSwaps = (context.rotation || [])
    .slice(0, Math.max(0, Number(context.index || 0)))
    .filter((entry) => rotationEntryName(entry, context) === 'Swap Legends').length;
  const destination = selected[(startingIndex + priorSwaps + 1) % 2];
  return revenantLegend(destination || '')?.icon || '';
}

export function revenantEventLogRow(
  _context: RevenantUiContext,
  event: RevenantResolverEvent
): ProfessionEventLogDescriptor | undefined {
  if (event?.type !== 'revenant.state') return undefined;
  return {
    type: event.type,
    description: `${event.reason || 'State'} - ` + `Energy ${displayedRevenantEnergy(event.state?.energy)}`,
    className: 'resource',
    order: 30,
    flags: []
  };
}

export function revenantCorePaletteSkillAvailability(
  context: RevenantUiContext = {},
  skill: RevenantSkill
): PaletteSkillAvailability {
  const state = revenantUiState(context);
  const activeLegend = activeRevenantLegend(context);
  // Check if the skill's paletteLegendId matches the active legend
  if (skill.paletteLegendId === activeLegend) {
    return {
      available: false,
      message: `${skill.displayName || 'Legend'} is already active`
    };
  }

  if (skill.id === SKILL.SWAP_LEGENDS || skill.paletteLegendId) {
    // The visible tile targets the inactive legend, but both destinations share
    // the combat-only legend-swap timer stored in profession state.
    const now = Number(context.time || 0);
    const readyAt = Number(state.legendSwapReadyAt || 0);
    if (readyAt > now) {
      return {
        available: false,
        message: 'Legend swap is recharging',
        retryAt: readyAt
      };
    }
  }

  // Check for Unyielding Impact and Call to Anguish flip availability
  if (skill.id === SKILL.UNYIELDING_IMPACT && !state.availableFlips?.[SKILL.UNYIELDING_IMPACT]) {
    return { available: false, message: 'Cast Call to Anguish first' };
  }

  // Check for Call to Anguish and Unyielding Impact flip availability
  if (skill.id === SKILL.CALL_TO_ANGUISH && state.availableFlips?.[SKILL.UNYIELDING_IMPACT]) {
    return { available: false, message: 'Use Unyielding Impact first' };
  }

  // Check if the skill is an upkeep and if it is currently active
  const upkeepActive =
    skill.handlerId === 'revenant.upkeep' && (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (upkeepActive) {
    return {
      available: false,
      message: 'Use the release skill to end this upkeep'
    };
  }

  // Check player energy and compare it against the effective energy cost of the skill, also check if the skill is on cooldown
  const energy = Number(state.energy);
  const cost = effectiveEnergyCost(context, skill);
  const onCooldown = Number(context.cooldowns?.[skill.name]?.remaining || 0) > 0;
  const available = !Number.isFinite(energy) || energy >= cost || onCooldown;
  return {
    available,
    message: !available && energy < cost ? `Requires ${cost} Energy; currently ${displayedRevenantEnergy(energy)}` : ''
  };
}

/** Reports shared Revenant drains and spear charges that directly constrain the next action. */
function revenantCoreStateSnapshot(context: RevenantUiContext): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
  const upkeeps = state.activeUpkeeps || [];
  const drain = upkeeps.reduce((total, upkeep) => total + Math.max(0, Number(upkeep.upkeepCost || 0)), 0);
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
    const nextExpiry = Math.min(...abyssExpiries) - at;
    items.push({
      id: 'revenant-crushing-abyss',
      label: 'Crushing Abyss',
      value: `${Math.min(3, abyssExpiries.length)}/3 · ${nextExpiry.toFixed(1)}s`,
      title: 'Active charges and time until the next charge expires'
    });
  }

  return items;
}

export const revenantCoreUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  assumptionControls: Object.freeze([...REVENANT_ASSUMPTION_CONTROLS, ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS]),
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
                fullDisplayName: destination.label,
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
  paletteSkillAvailability: revenantCorePaletteSkillAvailability,
  resourceViews: (context: RevenantUiContext) => {
    const state = revenantUiState(context);
    return [
      {
        id: 'energy',
        singular: 'energy',
        plural: 'energy',
        maximum: 100,
        value: displayedRevenantEnergy(state.energy ?? context.initialEnergy ?? 50),
        startMaximum: 100,
        startValue: Number(context.initialEnergy ?? 50),
        canStart: true,
        buildKey: 'initialEnergy',
        step: 1,
        displayMode: 'bar',
        pipStyle: 'compact-profession-resource-revenant-energy',
        shortLabel: 'E',
        statusLabel: 'Current'
      }
    ];
  },
  eventLogRow: revenantEventLogRow
});
