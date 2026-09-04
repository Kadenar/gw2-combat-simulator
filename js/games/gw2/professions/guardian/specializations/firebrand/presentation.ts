import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { guardianUiSkillIdsByName, guardianUiSkillsByMode } from '#gw2/professions/guardian/core/presentation.js';
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionSkillBarGroup
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext
} from '#gw2/professions/guardian/types.js';

function firebrandEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  // null suppresses the row entirely; these internal bookkeeping events have no
  // meaningful log representation and would clutter the event timeline.
  if (['guardian.ashes-expired', 'guardian.firebrand-virtue-activated'].includes(event.type)) return null;
  const base = {
    type: event.type,
    className: 'resource',
    order: 30,
    flags: []
  };
  if (event.type === 'guardian.tome-stowed') {
    return { ...base, description: 'TOME STOWED' };
  }

  if (event.type === 'guardian.tome-page-used') {
    const cost = Math.max(1, Number(event.pageCost || 1));
    return {
      ...base,
      description:
        `TOME PAGE USED ${event.skillName || event.tome || 'Unknown'} ` +
        `(-${cost}) -> ${Number(event.pagesRemaining || 0)} remaining`
    };
  }

  return undefined;
}

const TOME_F_KEY_NAMES = Object.freeze(['Tome of Justice', 'Tome of Resolve', 'Tome of Courage']);
const TOME_PALETTE_NAMES = Object.freeze([...TOME_F_KEY_NAMES, 'Stow Tome']);
const TOME_DORMANCY_LABELS = Object.freeze([
  ['justice', 'F1 Justice'],
  ['resolve', 'F2 Resolve'],
  ['courage', 'F3 Courage']
] as const);

function professionState(context: GuardianUiContext): Partial<GuardianState> {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

function dormantTomeClasses(context: GuardianUiContext): string {
  const readyAt = professionState(context).tomeDormantReadyAt;
  const at = Number(context.time ?? context.simulationTime ?? 0);
  // Project dormancy onto the existing Tome group so CSS can tint only the
  // affected opener while the skill remains available to equip.
  return TOME_DORMANCY_LABELS.filter(([virtue]) => Number(readyAt?.[virtue] || 0) > at)
    .map(([virtue]) => `tome-${virtue}-dormant`)
    .join(' ');
}

function tomeGroups(context: GuardianUiContext): ProfessionSkillBarGroup[] {
  return [
    {
      id: 'guardian-f-keys',
      label: 'F Keys',
      // Stow Tome remains a rotation action but is not a separate F-key slot
      // in the read-only skill-bar preview.
      skillIds: guardianUiSkillIdsByName(TOME_F_KEY_NAMES, context),
      color: '#2f7eb8',
      className: 'guardian-tome-f-keys',
      layout: 'guardian-tomes'
    },
    ...[
      ['justice', 'Tome of Justice', '#d26b46'],
      ['resolve', 'Tome of Resolve', '#5dad7d'],
      ['courage', 'Tome of Courage', '#6d96ce']
    ].map(([tome, label, color]) => ({
      id: `guardian-tome-${tome}`,
      label,
      skillIds: guardianUiSkillsByMode('tome', tome),
      color,
      className: 'guardian-tome-chapters',
      layout: 'guardian-tomes'
    }))
  ];
}

export const firebrandUi = Object.freeze({
  eventLogRow: firebrandEventLogRow,
  timelineWeaponLineTransition: (context: GuardianUiContext) => {
    const skill = context.skill as GuardianSkill | undefined;
    if (/^Tome of (Justice|Resolve|Courage)$/.test(skill?.name || '')) {
      // Returning undefined means "no transition" (already in this tome);
      // returning the skill name triggers the timeline lane switch.
      return context.weaponLine === skill?.name ? undefined : skill?.name;
    }

    if (skill?.name === 'Stow Tome') {
      // null signals "end of a named weapon line" to the timeline renderer;
      // undefined means there was no active tome line to close.
      return /^Tome of /.test(String(context.weaponLine || '')) ? null : undefined;
    }

    return undefined;
  },
  skillBarGroups: tomeGroups,
  paletteGroups: (context: GuardianUiContext): ProfessionPaletteGroup[] => [
    {
      id: 'profession',
      label: 'F',
      skillIds: guardianUiSkillIdsByName(TOME_PALETTE_NAMES, context),
      color: '#2f7eb8',
      className: `guardian-tome-f-keys ${dormantTomeClasses(context)}`.trim(),
      // resourceAnchor attaches the tome-pages resource view to this group's
      // position while the unattached dormancy view follows the Tome row.
      resourceAnchor: true,
      resourceIds: ['pages'],
      resourcePlacement: 'above'
    },
    ...[
      ['justice', 'F1', '#d26b46'],
      ['resolve', 'F2', '#5dad7d'],
      ['courage', 'F3', '#6d96ce']
    ].map(([tome, label, color]) => ({
      id: `tome-${tome}`,
      label,
      skillIds: guardianUiSkillsByMode('tome', tome),
      color
    }))
  ],
  paletteSkillAvailability: (context: GuardianUiContext, skill: GuardianSkill): PaletteSkillAvailability => {
    const state = professionState(context);
    if (skill.type === 'Weapon' && state.activeTome) {
      return {
        available: false,
        message: 'Weapon skills are unavailable while a tome is equipped'
      };
    }

    if (skill.tome && !state.activeTome) {
      return {
        available: false,
        message: 'Equip this tome to use its chapter skills'
      };
    }

    if (skill.tome && state.activeTome !== skill.tome) {
      return {
        available: false,
        message: `Currently using the ${state.activeTome} tome`
      };
    }

    const pageCost = Number(skill.pageCost || 1);
    if (skill.tome && Number(state.tomePages || 0) < pageCost) {
      return {
        available: false,
        message: `Requires ${pageCost} tome pages`
      };
    }

    if (skill.name === 'Stow Tome' && !state.activeTome) {
      return {
        available: false,
        message: 'No tome is currently equipped'
      };
    }

    return { available: true, message: '' };
  },
  resourceViews: (context: GuardianUiContext) => {
    const state = professionState(context);
    const maximum = Number(state.maximumTomePages || 5);
    const simulationTime = Number(context.simulationTime || 0);
    const readyAt = state.tomeDormantReadyAt || { justice: 0, resolve: 0, courage: 0 };
    // Keep passive readiness visible without adding three more resource bars.
    const virtueStatuses = TOME_DORMANCY_LABELS.map(([virtue, label]) => {
      const remaining = Math.max(0, Number(readyAt[virtue] || 0) - simulationTime);
      const valueLabel = remaining > 0 ? `Dormant ${remaining.toFixed(1)}s` : 'Ready';
      return { id: virtue, label, valueLabel, title: `${label}: ${valueLabel}` };
    });
    return [
      {
        id: 'pages',
        singular: 'page',
        plural: 'pages',
        maximum,
        value: Number(state.tomePages ?? maximum),
        // Pages regen passively; the user cannot manually start regeneration.
        canStart: false,
        shortLabel: 'Pgs',
        statusLabel: 'Current'
      },
      {
        id: 'tome-dormancy',
        singular: 'dormancy',
        plural: 'dormancy',
        maximum: 1,
        value: 0,
        canStart: false,
        shortLabel: 'Dormancy',
        statusLabel: 'Tome dormancy',
        displayMode: 'status',
        statusItems: virtueStatuses,
        showValue: false
      }
    ];
  }
});
