import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type {
  ProfessionPaletteActionIdentity,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import {
  VINDICATOR_AIRBORNE_MS,
  VINDICATOR_LANDING_MS,
  VINDICATOR_DODGE_MS
} from '#gw2/professions/revenant/data/vindicator-dodge.js';
import type { RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';

// Sentinel string used as a skill ID/name for the synthetic palette entry; never maps to a real skill.
export const VINDICATOR_DODGE_AUTO_ACTION = '__vindicator_dodge_auto';

const VINDICATOR_DODGE_AUTO_ICON =
  'https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png';

function activeAutoattack(context: RevenantUiContext): Skill | null {
  // activeAutoattack may be a raw ID string rather than a Skill object; guard ensures we only return a full object.
  const skill = context.activeAutoattack;
  return skill && typeof skill === 'object' ? skill : null;
}

function vindicatorDodgeAutoPaletteSkill(context: RevenantUiContext): Skill | null {
  // No auto-attack means there's nothing to pair a dodge with; suppress the synthetic entry.
  if (!activeAutoattack(context)) return null;

  return {
    id: VINDICATOR_DODGE_AUTO_ACTION,
    name: VINDICATOR_DODGE_AUTO_ACTION,
    displayName: 'Dodge + Auto',
    description: `Start the ${VINDICATOR_AIRBORNE_MS} ms dodge + ${VINDICATOR_LANDING_MS} ms landing and the current autoattack together.`,
    icon: VINDICATOR_DODGE_AUTO_ICON,
    type: 'Action',
    slot: 'Action',
    // The combined palette action occupies the same non-instant jump as a normal dodge.
    castTimeMs: VINDICATOR_DODGE_MS
  };
}

/** The combined palette action starts the active autoattack concurrently with dodge takeoff. */
export function vindicatorDodgeAutoRotationEntries(context: RevenantUiContext): RotationCommand[] {
  const autoattack = activeAutoattack(context);

  if (!autoattack) return [];

  return [
    {
      type: 'cast',
      skillId: SHARED_SKILL_IDS.DODGE
    },
    {
      type: 'cast',
      skillId: autoattack.id,
      // Pay endurance at takeoff before the concurrent auto starts inside the jump.
      concurrentOffsetMs: 0
    }
  ];
}

function vindicatorPaletteActionSkills(context: RevenantUiContext, skills: readonly Skill[]): Skill[] {
  // Strip any stale synthetic entry first so it cannot appear twice if called repeatedly.
  const ordinarySkills = skills
    .filter((skill) => skill.id !== VINDICATOR_DODGE_AUTO_ACTION)
    // Present the active specialization's full jump while preserving the shared command identity and cost.
    .map((skill) =>
      skill.id === SHARED_SKILL_IDS.DODGE
        ? {
            ...skill,
            displayName: 'Dodge + Landing',
            description: `${VINDICATOR_AIRBORNE_MS} ms airborne dodge + ${VINDICATOR_LANDING_MS} ms landing. Endurance is spent at takeoff; the selected dodge effect resolves on landing.`,
            castTimeMs: VINDICATOR_DODGE_MS
          }
        : skill
    );
  const dodgeAuto = vindicatorDodgeAutoPaletteSkill(context);

  if (!dodgeAuto) return ordinarySkills;

  const dodgeIndex = ordinarySkills.findIndex((skill) => skill.id === SHARED_SKILL_IDS.DODGE);
  // Insert immediately after Dodge in the palette; if Dodge is absent, prepend at index 0.
  ordinarySkills.splice(dodgeIndex < 0 ? 0 : dodgeIndex + 1, 0, dodgeAuto);
  return ordinarySkills;
}

function resolveVindicatorPaletteAction(
  context: RevenantUiContext,
  action: ProfessionPaletteActionIdentity
): RotationCommand[] | undefined {
  // Return undefined for unrecognized actions so the platform can try other resolvers.
  return action.name === VINDICATOR_DODGE_AUTO_ACTION ? vindicatorDodgeAutoRotationEntries(context) : undefined;
}

/** Shows the armed Reaver's Curse window until the next dodge consumes it. */
function vindicatorStateSnapshot(context: RevenantUiContext): RotationStateSnapshotItem[] {
  const expiresAt = revenantUiState(context).reaversCurseUntil || 0;
  const remaining = expiresAt - Math.max(0, context.atSeconds || 0);
  // A landing exactly at expiry can still consume the armed charge.
  return expiresAt > 0 && remaining >= 0
    ? [
        {
          id: 'vindicator-reavers-curse',
          label: "Reaver's Curse",
          value: `${remaining.toFixed(1)}s`,
          title: "Time remaining to consume Reaver's Curse with a dodge"
        }
      ]
    : [];
}

export const vindicatorUi: RevenantUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    // Expose held combat bonuses to isolated damage calculations.
    preview.damageBuff('Forerunner of Death', 'forerunnerOfDeath', 'forerunner-of-death');
    preview.playerHealth(['Empire Divided']);
    return preview.controls;
  },

  rotationStateSnapshot: vindicatorStateSnapshot,
  // Alliance has one supported skill bar; the specialization group only adds Energy Meld.
  paletteGroups: () => [
    {
      id: 'revenant-profession-specialization',
      label: 'F',
      skillIds: [SKILL.ENERGY_MELD],
      color: '#a84f54',
      resourceAnchor: true
    }
  ],
  resourceViews: (context: RevenantUiContext) => {
    const state = revenantUiState(context);
    return [
      {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        // Capacity is the shared Revenant bound used by live recovery.
        maximum: state.endurance?.maximum ?? REVENANT_MAXIMUM_ENDURANCE,
        value: state.endurance?.value ?? 100,
        canStart: false,
        step: 1,
        displayMode: 'bar',
        pipStyle: 'endurance',
        shortLabel: 'End',
        statusLabel: 'Current',
        // Render the endurance meter beneath the Dodge button (which the
        // Vindicator dodge spends in one leap) instead of as a standalone bar.
        paletteSkillId: SHARED_SKILL_IDS.DODGE
      }
    ];
  },
  paletteActionSkills: vindicatorPaletteActionSkills,
  resolvePaletteAction: resolveVindicatorPaletteAction
});
