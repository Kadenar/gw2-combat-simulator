import { simulateGw2 } from "../platform/gw2/simulate.js";
import type {
  Gw2ProfessionContract,
  Gw2SimulationResult,
} from "../platform/gw2/types.js";
import type { RotationSimulation } from "./types.js";

type ProfessionModule = {
  readonly default: unknown;
};

const professionLoaders: Readonly<
  Record<string, () => Promise<ProfessionModule>>
> = Object.freeze({
  elementalist: () => import("../professions/elementalist/definition.js"),
  engineer: () => import("../professions/engineer/definition.js"),
  guardian: () => import("../professions/guardian/definition.js"),
  mesmer: () => import("../professions/mesmer/definition.js"),
  necromancer: () => import("../professions/necromancer/definition.js"),
  ranger: () => import("../professions/ranger/definition.js"),
  revenant: () => import("../professions/revenant/definition.js"),
  thief: () => import("../professions/thief/definition.js"),
  warrior: () => import("../professions/warrior/definition.js"),
});

/**
 * Loads only the engine-facing profession contract. Importing a browser app
 * adapter here would pull the optimizer UI back into its own worker bundle.
 */
export async function loadRotationOptimizerSimulation(
  professionId: string,
): Promise<RotationSimulation | null> {
  const load = professionLoaders[professionId];
  if (!load) return null;
  const profession = (await load()).default as Gw2ProfessionContract;
  return (rotation, config): Gw2SimulationResult =>
    simulateGw2({ profession, rotation, config });
}
