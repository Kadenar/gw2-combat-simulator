import type {
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import { ELEMENTALIST_FAMILIAR_SKILL_IDS } from "../../data/ids.js";
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement,
} from "../../core/state.js";
import type { EvokerState } from "./state.js";

function uiState(context: SchedulerRecord): Partial<EvokerState> {
  return (context.professionState as Partial<EvokerState> | undefined) || {};
}

function selectedElement(context: SchedulerRecord): ElementalistAttunement {
  const build = context.build as SchedulerRecord | undefined;
  const value = String(
    uiState(context).element || build?.evokerElement || "Fire",
  );
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : "Fire";
}

const FAMILIAR_SKILL_NAMES = Object.freeze({
  Fire: { basic: "Ignite", empowered: "Conflagration" },
  Water: { basic: "Splash", empowered: "BuoyantDeluge" },
  Air: { basic: "Zap", empowered: "LightningBlitz" },
  Earth: { basic: "Calcify", empowered: "SeismicImpact" },
} as const);

function familiarSkillId(
  context: SchedulerRecord,
  element = selectedElement(context),
): number {
  const state = uiState(context);
  const build = context.build as SchedulerRecord | undefined;
  const empowered = Number(
    state.empowered ?? build?.initialEvokerEmpowered ?? 0,
  );
  const name =
    FAMILIAR_SKILL_NAMES[element][empowered >= 3 ? "empowered" : "basic"];
  return ELEMENTALIST_FAMILIAR_SKILL_IDS[name];
}

function updateFamiliarSelection(
  context: SchedulerRecord,
  selection: SchedulerRecord,
): boolean {
  const value = String(selection.value || "");
  if (
    selection.key !== "evokerElement" ||
    Number(selection.index) !== 0 ||
    !ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement) ||
    !context.build ||
    typeof context.build !== "object"
  ) {
    return false;
  }
  (context.build as SchedulerRecord).evokerElement = value;
  return true;
}

export const evokerUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    skillBarGroups: (context: SchedulerRecord) => {
      const element = selectedElement(context);
      return [
        {
          id: "elementalist-evoker-familiar",
          label: "Familiar",
          skillIds: [],
          selections: [
            {
              skillId: familiarSkillId(context),
              optionEntries: ELEMENTALIST_ATTUNEMENTS.map((option) => {
                const skillId = familiarSkillId(context, option);
                const skill = (
                  context.catalog as
                    | {
                        skillsById?: ReadonlyMap<
                          number,
                          { icon?: string; description?: string }
                        >;
                      }
                    | undefined
                )?.skillsById?.get(skillId);
                return {
                  value: option,
                  label: `${option} Familiar`,
                  icon: skill?.icon,
                  description: skill?.description || `${option} familiar`,
                  skillId,
                };
              }),
              selectionValue: element,
              selectionKey: "evokerElement",
              selectionIndex: 0,
            },
          ],
          color: "#c85142",
          className: "elementalist-familiar",
        },
      ];
    },
    updateSkillBarSelection: updateFamiliarSelection,
    paletteGroups: (context: SchedulerRecord) => [
      {
        id: "elementalist-evoker-familiars",
        label: "F5",
        skillIds: [familiarSkillId(context)],
        color: "#c85142",
        resourceAnchor: true,
      },
    ],
    resourceViews: (context: SchedulerRecord): ProfessionResourceView[] => {
      const state = uiState(context);
      const build = context.build as SchedulerRecord | undefined;
      const maximum = Number(state.maximumCharges || 6);
      return [
        {
          id: "evoker-charges",
          singular: "charge",
          plural: "charges",
          maximum,
          value: Number(
            state.charges ?? build?.initialEvokerCharges ?? maximum,
          ),
          startMaximum: maximum,
          startValue: Number(build?.initialEvokerCharges ?? maximum),
          canStart: true,
          buildKey: "initialEvokerCharges",
          step: 1,
          displayMode: "pips",
          shortLabel: "Charges",
          statusLabel: `Empowered ${Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0)}/3`,
        },
      ];
    },
  });
