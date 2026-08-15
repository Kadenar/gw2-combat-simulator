import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
} from "../../data/ids.js";
import { revenantUiState } from "../../core/ui.js";
import type {
  LegacyRotationItem,
  ProfessionPaletteActionIdentity,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "../../../../platform/engine/types.js";
import type { RevenantUiContext } from "../../types.js";

export const VINDICATOR_DODGE_AUTO_ACTION = "__vindicator_dodge_auto";

const VINDICATOR_DODGE_AUTO_ICON =
  "https://render.guildwars2.com/file/2864D963D3FC9156E6F52FA95DD34C2DE30306BE/2491537.png";

function activeAutoattack(context: SchedulerRecord): Skill | null {
  const skill = context.activeAutoattack;
  return skill && typeof skill === "object" ? (skill as Skill) : null;
}

export function vindicatorDodgeAutoPaletteSkill(
  context: SchedulerRecord,
): Skill | null {
  if (String(context.specialization || "") !== "Vindicator") return null;
  if (!activeAutoattack(context)) return null;
  return {
    id: VINDICATOR_DODGE_AUTO_ACTION,
    name: VINDICATOR_DODGE_AUTO_ACTION,
    displayName: "Dodge + Auto",
    description:
      "Cast the current auto-chain step and one Dodge at the same time.",
    icon: VINDICATOR_DODGE_AUTO_ICON,
    type: "Action",
    slot: "Action",
    castTimeMs: 0,
    implemented: true,
  };
}

export function vindicatorDodgeAutoRotationEntries(
  context: SchedulerRecord,
  offsetMs = 0,
): LegacyRotationItem[] {
  const autoattack = activeAutoattack(context);
  if (!autoattack) return [];
  return [
    {
      name: autoattack.name,
      skillId: autoattack.id,
    },
    {
      name: "Dodge",
      skillId: SKILL.DODGE,
      offset: Math.max(0, Math.round(Number(offsetMs) || 0)),
    },
  ];
}

function vindicatorPaletteActionSkills(
  context: SchedulerRecord,
  skills: readonly Skill[],
): Skill[] {
  const ordinarySkills = skills.filter(
    (skill) => skill.name !== VINDICATOR_DODGE_AUTO_ACTION,
  );
  const dodgeAuto = vindicatorDodgeAutoPaletteSkill(context);
  if (!dodgeAuto) return ordinarySkills;
  const dodgeIndex = ordinarySkills.findIndex(
    (skill) => skill.name === "Dodge",
  );
  ordinarySkills.splice(dodgeIndex < 0 ? 0 : dodgeIndex + 1, 0, dodgeAuto);
  return ordinarySkills;
}

function resolveVindicatorPaletteAction(
  context: SchedulerRecord,
  action: ProfessionPaletteActionIdentity,
): LegacyRotationItem[] | undefined {
  return action.name === VINDICATOR_DODGE_AUTO_ACTION
    ? vindicatorDodgeAutoRotationEntries(context)
    : undefined;
}

export const vindicatorUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    paletteGroups: (context: RevenantUiContext) => {
      const state = revenantUiState(context);
      return [
        {
          id: "revenant-profession-specialization",
          label: "F",
          skillIds: [SKILL.ALLIANCE_TACTICS, SKILL.ENERGY_MELD],
          color: "#a84f54",
          resourceAnchor: true,
        },
        ...(state.activeLegendId === LEGEND.ALLIANCE &&
        state.allianceSide === "kurzick"
          ? [
              {
                id: "revenant-alliance-kurzick",
                label: "Kurz",
                skillIds: [
                  SKILL.SELFLESS_SPIRIT,
                  SKILL.BATTLE_DANCE,
                  SKILL.TREE_SONG,
                  SKILL.AWAKENING,
                  SKILL.URN_OF_SAINT_VIKTOR,
                ],
                color: "#7696c7",
              },
            ]
          : []),
      ];
    },
    resourceViews: (context: RevenantUiContext) => {
      const state = revenantUiState(context);
      return [
        {
          id: "endurance",
          singular: "endurance",
          plural: "endurance",
          maximum: Number(state.maximumEndurance || 100),
          value: Number(state.endurance ?? 100),
          canStart: false,
          step: 1,
          displayMode: "bar",
          pipStyle: "endurance",
          shortLabel: "End",
          statusLabel: "Current",
          // Render the endurance meter beneath the Dodge button (which the
          // Vindicator dodge spends in one leap) instead of as a standalone bar.
          paletteSkillId: SKILL.DODGE,
        },
      ];
    },
    paletteActionSkills: vindicatorPaletteActionSkills,
    resolvePaletteAction: resolveVindicatorPaletteAction,
  });
