import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import type {
  ProfessionPaletteActionIdentity,
  ProfessionUiContract,
  RotationCommand,
  RotationStateSnapshotItem,
  SchedulerRecord,
  Skill
} from '#gw2/platform/engine/types.js';
import type { RevenantUiContext } from '#gw2/professions/revenant/types.js';

// Sentinel string used as a skill ID/name for the synthetic palette entry; never maps to a real skill.
export const VINDICATOR_DODGE_AUTO_ACTION = '__vindicator_dodge_auto';

const VINDICATOR_DODGE_AUTO_ICON =
  'https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png';

function activeAutoattack(context: SchedulerRecord): Skill | null {
  // activeAutoattack may be a raw ID string rather than a Skill object; guard ensures we only return a full object.
  const skill = context.activeAutoattack;
  return skill && typeof skill === 'object' ? (skill as Skill) : null;
}

export function vindicatorDodgeAutoPaletteSkill(context: SchedulerRecord): Skill | null {
  // Guard specialization first: this helper is called from shared palette code that doesn't know the spec.
  if (String(context.specialization || '') !== 'Vindicator') return null;
  // No auto-attack means there's nothing to pair a dodge with; suppress the synthetic entry.
  if (!activeAutoattack(context)) return null;
  return {
    id: VINDICATOR_DODGE_AUTO_ACTION,
    name: VINDICATOR_DODGE_AUTO_ACTION,
    displayName: 'Dodge + Auto',
    description: 'Cast the current auto-chain step and one Dodge at the same time.',
    icon: VINDICATOR_DODGE_AUTO_ICON,
    type: 'Action',
    slot: 'Action',
    // castTimeMs: 0 so the palette does not show a cast-time ring around this synthetic entry.
    castTimeMs: 0
  };
}

export function vindicatorDodgeAutoRotationEntries(context: SchedulerRecord, offsetMs = 0): RotationCommand[] {
  const autoattack = activeAutoattack(context);
  if (!autoattack) return [];
  return [
    {
      type: 'cast',
      skillId: autoattack.id
    },
    {
      type: 'cast',
      skillId: SKILL.DODGE,
      // offsetMs positions the dodge relative to the auto; clamped to 0 so a negative offset is ignored.
      concurrentOffsetMs: Math.max(0, Math.round(Number(offsetMs) || 0))
    }
  ];
}

function vindicatorPaletteActionSkills(context: SchedulerRecord, skills: readonly Skill[]): Skill[] {
  // Strip any stale synthetic entry first so it cannot appear twice if called repeatedly.
  const ordinarySkills = skills.filter((skill) => skill.name !== VINDICATOR_DODGE_AUTO_ACTION);
  const dodgeAuto = vindicatorDodgeAutoPaletteSkill(context);
  if (!dodgeAuto) return ordinarySkills;
  const dodgeIndex = ordinarySkills.findIndex((skill) => skill.name === 'Dodge');
  // Insert immediately after Dodge in the palette; if Dodge is absent, prepend at index 0.
  ordinarySkills.splice(dodgeIndex < 0 ? 0 : dodgeIndex + 1, 0, dodgeAuto);
  return ordinarySkills;
}

function resolveVindicatorPaletteAction(
  context: SchedulerRecord,
  action: ProfessionPaletteActionIdentity
): RotationCommand[] | undefined {
  // Return undefined for unrecognized actions so the platform can try other resolvers.
  return action.name === VINDICATOR_DODGE_AUTO_ACTION ? vindicatorDodgeAutoRotationEntries(context) : undefined;
}

/** Shows the armed Reaver's Curse window until the next dodge consumes it. */
function vindicatorStateSnapshot(context: RevenantUiContext): RotationStateSnapshotItem[] {
  const remaining =
    Number(revenantUiState(context).reaversCurseUntil || 0) - Math.max(0, Number(context.atSeconds || 0));
  return remaining > 0
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

export const vindicatorUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  rotationStateSnapshot: vindicatorStateSnapshot,
  paletteGroups: (context: RevenantUiContext) => {
    const state = revenantUiState(context);
    return [
      {
        id: 'revenant-profession-specialization',
        label: 'F',
        skillIds: [SKILL.ALLIANCE_TACTICS, SKILL.ENERGY_MELD],
        color: '#a84f54',
        resourceAnchor: true
      },
      // Kurzick skill group is only shown while on the Kurzick side; Luxon skills appear in the main bar.
      ...(state.activeLegendId === LEGEND.ALLIANCE && state.allianceSide === 'kurzick'
        ? [
            {
              id: 'revenant-alliance-kurzick',
              label: 'Kurz',
              skillIds: [
                SKILL.SELFLESS_SPIRIT,
                SKILL.BATTLE_DANCE,
                SKILL.TREE_SONG,
                SKILL.AWAKENING,
                SKILL.URN_OF_SAINT_VIKTOR
              ],
              color: '#7696c7'
            }
          ]
        : [])
    ];
  },
  resourceViews: (context: RevenantUiContext) => {
    const state = revenantUiState(context);
    return [
      {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        maximum: Number(state.maximumEndurance || 100),
        value: Number(state.endurance ?? 100),
        canStart: false,
        step: 1,
        displayMode: 'bar',
        pipStyle: 'endurance',
        shortLabel: 'End',
        statusLabel: 'Current',
        // Render the endurance meter beneath the Dodge button (which the
        // Vindicator dodge spends in one leap) instead of as a standalone bar.
        paletteSkillId: SKILL.DODGE
      }
    ];
  },
  paletteActionSkills: vindicatorPaletteActionSkills,
  resolvePaletteAction: resolveVindicatorPaletteAction
});
