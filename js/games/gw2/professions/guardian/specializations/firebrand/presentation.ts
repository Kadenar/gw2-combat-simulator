import { BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';

import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import type {
  ProfessionCatalogContext,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIds,
  guardianUiSkillsByMode
} from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { firebrandPageTuning } from '#gw2/professions/guardian/specializations/firebrand/traits/page-tuning.js';
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianPlanningState,
  GuardianUiContext,
  GuardianUiSlice
} from '#gw2/professions/guardian/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/** Render actual weapon-bar transitions at their executed boundary. */
function firebrandEventLogRow(
  _context: GuardianUiContext,
  event: GuardianResolverEvent
): ProfessionEventLogDescriptor | undefined {
  if (
    event.type !== 'weapon_set' ||
    ![
      GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
      GUARDIAN_SKILL_IDS.TOME_OF_RESOLVE,
      GUARDIAN_SKILL_IDS.TOME_OF_COURAGE,
      GUARDIAN_SKILL_IDS.STOW_TOME
    ].some((id) => id === event.skillId)
  )
    return undefined;

  return {
    type: event.type,
    description: event.skillId === GUARDIAN_SKILL_IDS.STOW_TOME ? 'TOME STOWED' : 'TOME EQUIPPED ' + event.skillName,
    className: 'resource',
    order: 30
  };
}

const TOME_F_KEY_IDS = Object.freeze([
  GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
  GUARDIAN_SKILL_IDS.TOME_OF_RESOLVE,
  GUARDIAN_SKILL_IDS.TOME_OF_COURAGE
]);
const TOME_PALETTE_IDS = Object.freeze([...TOME_F_KEY_IDS, GUARDIAN_SKILL_IDS.STOW_TOME]);
const TOME_DORMANCY_LABELS = Object.freeze([
  ['justice', 'F1 Justice'],
  ['resolve', 'F2 Resolve'],
  ['courage', 'F3 Courage']
] as const);

/** Display the live page clock and current tome's refund progress without inventing a second regeneration timer. */
function firebrandStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const state = professionState(context);
  const at = guardianSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  const pages = state[STATE.TOME_PAGES];

  if (pages && pages.interval > 0 && Number.isFinite(pages.nextAt) && pages.nextAt > at) {
    const remaining = formatSecondsRemaining(pages.nextAt - at);
    const full = pages.value >= pages.maximum;
    items.push({
      id: 'firebrand-purity-of-word',
      label: 'Purity of Word',
      value: `${remaining}${full ? ' · Full' : ''}`,
      title: `${full ? 'Next regeneration tick' : 'Next page'} in ${remaining}${full ? ' (pages are full)' : ''}. Regenerates every ${formatSecondsRemaining(pages.interval)}.`
    });
  }

  if (state[STATE.ACTIVE_TOME]) {
    const threshold = balanceNumberFromContext(
      context.balanceContext,
      GUARDIAN_TRAIT_IDS.SWIFT_SCHOLAR,
      'minimumStacks'
    );
    items.push({
      id: 'firebrand-swift-scholar',
      label: 'Swift Scholar',
      value: `${state[STATE.SWIFT_SCHOLAR_COUNT] ?? 0}/${threshold}`,
      title: 'Tome skill progress toward the next Swift Scholar page refund; resets when exiting a tome'
    });
  }

  return items;
}

function dormantTomeClasses(context: GuardianUiContext): string {
  // Palette tint and countdowns observe the same projected deadlines used by passive mechanics.
  const readyAt = professionState(context)[STATE.VIRTUE_READY_AT];
  const at = context.time ?? context.simulationTime ?? 0;
  // Project dormancy onto the existing Tome group so CSS can tint only the
  // affected opener while the skill remains available to equip.
  return TOME_DORMANCY_LABELS.filter(([virtue]) => (readyAt?.[virtue] || 0) > at)
    .map(([virtue]) => `tome-${virtue}-dormant`)
    .join(' ');
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindFirebrandUi(catalog: Readonly<CanonicalCatalog<GuardianSkill>>): GuardianUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      preview.boon(boonKey(BOON.QUICKNESS), 'Imbued Haste');
      return preview.controls;
    },

    rotationStateSnapshot: firebrandStateSnapshot,
    eventLogRow: firebrandEventLogRow,
    timelineWeaponLineTransition: (context: GuardianUiContext) => {
      const skill = context.skill;

      if (/^Tome of (Justice|Resolve|Courage)$/.test(skill?.name || '')) {
        // Returning undefined means "no transition" (already in this tome);
        // returning the skill name triggers the timeline lane switch.
        return context.weaponLine === skill?.name ? undefined : skill?.name;
      }

      if (skill?.id === GUARDIAN_SKILL_IDS.STOW_TOME) {
        // null signals "end of a named weapon line" to the timeline renderer;
        // undefined means there was no active tome line to close.
        return /^Tome of /.test(context.weaponLine || '') ? null : undefined;
      }

      return undefined;
    },
    paletteGroups: (context: GuardianUiContext): ProfessionPaletteGroup[] => [
      {
        id: 'profession',
        label: 'F',
        skillIds: guardianUiSkillIds(catalog, TOME_PALETTE_IDS, context),
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
        skillIds: guardianUiSkillsByMode(catalog, 'tome', tome),
        color
      }))
    ],
    resourceViews: (context: GuardianUiContext & ProfessionCatalogContext): ProfessionResourceView[] => {
      const state = professionState(context);
      // Starting limits follow the current build and patch, independently of an older simulation's projection.
      const tuningContext = {
        ...context,
        config: context.config ?? {},
        traits: context.build
          ? new Set(selectedTraits(context.catalog, context.build.specializations).map((trait) => trait.id))
          : context.traits
      };
      const startMaximum = firebrandPageTuning(tuningContext).maximum;
      const maximum = state[STATE.TOME_PAGES]?.maximum ?? startMaximum;
      const simulationTime = context.simulationTime || 0;
      const readyAt = state[STATE.VIRTUE_READY_AT] || { justice: 0, resolve: 0, courage: 0 };
      // Keep passive readiness visible without adding three more resource bars.
      const virtueStatuses = TOME_DORMANCY_LABELS.map(([virtue, label]) => {
        const remaining = Math.max(0, (readyAt[virtue] || 0) - simulationTime);
        const valueLabel = remaining > 0 ? `Dormant ${remaining.toFixed(1)}s` : 'Ready';
        return { id: virtue, label, valueLabel, title: `${label}: ${valueLabel}` };
      });
      return [
        {
          id: 'pages',
          singular: 'page',
          plural: 'pages',
          maximum,
          value: state[STATE.TOME_PAGES]?.value ?? maximum,
          // Edit starting pages independently of passive regeneration using the selected patch's capacity.
          canStart: true,
          startMaximum,
          buildKey: 'initialTomePages',
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
}

function professionState(context: GuardianUiContext): Partial<GuardianPlanningState> {
  // Presentation callers supply the flat projection for the inspected rotation point.
  return context.professionState ?? {};
}
