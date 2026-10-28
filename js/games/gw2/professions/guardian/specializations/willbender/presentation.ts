import { activeRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import type {
  ProfessionEffectPresentation,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIds,
  guardianUiState
} from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS as WILLBENDER_TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianSkill, GuardianUiContext, GuardianUiSlice } from '#gw2/professions/guardian/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { boundedInteger } from '#kernel/core/numeric.js';

const VIRTUE_IDS = Object.freeze([
  GUARDIAN_SKILL_IDS.RUSHING_JUSTICE,
  GUARDIAN_SKILL_IDS.FLOWING_RESOLVE,
  GUARDIAN_SKILL_IDS.CRASHING_COURAGE
]);

/** Reports active virtue flames and Lethal Tempo so Willbender follow-up timing is inspectable. */
function willbenderStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const state = guardianUiState(context);
  const at = guardianSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  for (const [id, label, expiresAt] of [
    ['willbender-rushing-justice', 'Rushing Justice', state[STATE.JUSTICE_UNTIL] || 0],
    ['willbender-flowing-resolve', 'Flowing Resolve', state[STATE.RESOLVE_UNTIL] || 0],
    ['willbender-crashing-courage', 'Crashing Courage', state[STATE.COURAGE_UNTIL] || 0]
  ] as const) {
    const remaining = expiresAt - at;

    // The final instant still accepts virtue hits, but an unarmed zero deadline is never active.
    if (expiresAt <= 0 || remaining < 0) continue;

    items.push({ id, label, value: formatSecondsRemaining(remaining), title: `${label} active window` });
  }

  const lethalRemaining = (state[STATE.LETHAL_TEMPO]?.expiresAt || 0) - at;
  const maximum = balanceNumberFromContext(context.balanceContext, WILLBENDER_TRAIT.LETHAL_TEMPO, 'maximumStacks');
  const lethalStacks = boundedInteger(activeRefreshedStacks(state[STATE.LETHAL_TEMPO], at, 'inclusive'), 0, 0, maximum);

  // Lethal Tempo remains available for damage and refreshes on its final tick.
  if ((state[STATE.LETHAL_TEMPO]?.expiresAt || 0) > 0 && lethalRemaining >= 0 && lethalStacks > 0) {
    items.push({
      id: 'willbender-lethal-tempo',
      label: 'Lethal Tempo',
      value: `${lethalStacks}/${maximum} · ${formatSecondsRemaining(lethalRemaining)}`,
      title: 'Active Lethal Tempo stacks and time remaining'
    });
  }

  return items;
}

/** Labels Willbender's timed effects and treats refreshed states as replacements rather than additive grants. */
function willbenderEffectPresentations(_context: GuardianUiContext): ProfessionEffectPresentation[] {
  return [
    ...[
      ['justice', 'Rushing Justice'],
      ['resolve', 'Flowing Resolve'],
      ['courage', 'Crashing Courage']
    ].map(([virtue, name]) => ({
      id: `guardian-willbender-${virtue}`,
      kind: `willbender-${virtue}`,
      name
    })),
    {
      id: 'guardian-lethal-tempo',
      kind: 'lethal-tempo',
      name: 'Lethal Tempo'
    }
  ];
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindWillbenderUi(catalog: Readonly<CanonicalCatalog<GuardianSkill>>): GuardianUiSlice {
  return Object.freeze({
    /** Tempo is a starting damage window; normal virtue grants still refresh its native pool. */
    previewControls(context) {
      const preview = createPreviewControls(context);
      preview.add({
        key: 'lethalTempo',
        label: 'Lethal Tempo',
        group: 'Mechanic',
        kind: 'buff',
        field: 'lethal-tempo',
        scope: ['damage'],
        max: balanceNumberFromContext(context, WILLBENDER_TRAIT.LETHAL_TEMPO, 'maximumStacks'),
        description: 'Starting virtue-earned damage stacks'
      });
      return preview.controls;
    },
    effectPresentations: willbenderEffectPresentations,
    rotationStateSnapshot: willbenderStateSnapshot,
    paletteGroups: (context: GuardianUiContext) => [
      {
        id: 'profession',
        label: 'F',
        skillIds: guardianUiSkillIds(catalog, VIRTUE_IDS, context),
        color: '#2f7eb8',
        resourceAnchor: true
      }
    ]
  });
}
