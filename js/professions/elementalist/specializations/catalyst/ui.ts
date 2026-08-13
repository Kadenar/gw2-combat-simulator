import type {
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import { CATALYST_MAXIMUM_ENERGY, type CatalystState } from "./state.js";

function uiState(context: SchedulerRecord): Partial<CatalystState> {
  return (context.professionState as Partial<CatalystState> | undefined) || {};
}

export const catalystUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    resourceViews: (context: SchedulerRecord): ProfessionResourceView[] => {
      const state = uiState(context);
      const build = context.build as SchedulerRecord | undefined;
      return [
        {
          id: "catalyst-energy",
          singular: "energy",
          plural: "energy",
          maximum: CATALYST_MAXIMUM_ENERGY,
          value: Number(
            state.energy ??
              build?.initialCatalystEnergy ??
              CATALYST_MAXIMUM_ENERGY,
          ),
          startMaximum: CATALYST_MAXIMUM_ENERGY,
          startValue: Number(
            build?.initialCatalystEnergy ?? CATALYST_MAXIMUM_ENERGY,
          ),
          canStart: true,
          buildKey: "initialCatalystEnergy",
          step: 1,
          displayMode: "bar",
          shortLabel: "Energy",
          statusLabel: "Catalyst",
        },
      ];
    },
  });
