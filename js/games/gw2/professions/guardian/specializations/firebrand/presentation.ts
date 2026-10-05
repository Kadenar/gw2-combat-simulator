import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIds,
  guardianUiSkillsByMode
} from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
  GuardianUiSlice
} from '#gw2/professions/guardian/types.js';

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
  const pages = state.tomePages;
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

  if (state.activeTome) {
    const threshold = balanceProfileNumber(
      requireBalanceProfileFromContext(context.balanceContext, GUARDIAN_TRAIT_IDS.SWIFT_SCHOLAR),
      'minimumStacks'
    );
    items.push({
      id: 'firebrand-swift-scholar',
      label: 'Swift Scholar',
      value: `${state.swiftScholarCount ?? 0}/${threshold}`,
      title: 'Tome skill progress toward the next Swift Scholar page refund; resets when exiting a tome'
    });
  }

  return items;
}

function dormantTomeClasses(context: GuardianUiContext): string {
  const readyAt = professionState(context).tomeDormantReadyAt;
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
      preview.boon('quickness', 'Imbued Haste');
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
    resourceViews: (context: GuardianUiContext) => {
      const state = professionState(context);
      // Preview capacity follows the selected catalog even before a simulation supplies resource state.
      const maximum =
        state.tomePages?.maximum ??
        context.resources?.tomePages?.maximum ??
        balanceProfileNumber(
          requireBalanceProfileFromContext(
            context,
            hasTrait(context.config, GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS)
              ? GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS
              : PROFILE.resources
          ),
          'maximumStacks'
        );
      const simulationTime = context.simulationTime || 0;
      const readyAt = state.tomeDormantReadyAt || { justice: 0, resolve: 0, courage: 0 };
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
          value: state.tomePages?.value ?? maximum,
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
}

function professionState(context: GuardianUiContext): Partial<GuardianState> {
  // Presentation callers supply the flat projection for the inspected rotation point.
  return context.professionState ?? {};
}
