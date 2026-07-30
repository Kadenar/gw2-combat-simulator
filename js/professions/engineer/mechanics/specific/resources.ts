import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../state.js";
import { emitEngineerState } from "./shared.js";
import type {
  EngineerSchedulerContext,
} from "../../types.js";

type EngineerResourceContext = EngineerSchedulerContext & {
  readonly start?: number;
};

const ENDURANCE_REGENERATION_PER_SECOND = 5;
const VIGOR_REGENERATION_BONUS = 0.5;
const ADRENAL_IMPLANT_REGENERATION_BONUS = 0.25;

export function engineerEnduranceRegenerationRate(
  context: EngineerResourceContext,
  at = Number(context.start ?? context.state?.time ?? 0),
): number {
  const vigor = Boolean(
    context.config?.boons?.vigor
    || context.hasBuff?.("vigor", at),
  );
  const multiplier =
    1
    + (vigor ? VIGOR_REGENERATION_BONUS : 0)
    + (
      hasEngineerTrait(context.config, TRAIT.ADRENAL_IMPLANT)
        ? ADRENAL_IMPLANT_REGENERATION_BONUS
        : 0
    );
  return ENDURANCE_REGENERATION_PER_SECOND * multiplier;
}

export function engineerEnduranceReadyAt(
  context: EngineerResourceContext & { readonly start: number },
  cost: number,
): number | null {
  const current = Number(context.state.profession.endurance || 0);
  const missing = Math.max(0, Number(cost || 0) - current);
  if (missing <= Number(context.epsilon || 0.0001)) return context.start;
  const rate = engineerEnduranceRegenerationRate(context, context.start);
  return rate > 0 ? context.start + missing / rate : null;
}

export function advanceEngineerResources(
  context: EngineerSchedulerContext,
  target: number,
): void {
  const state = context.state.profession;
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  state.endurance = Math.min(
    Number(state.maximumEndurance || 100),
    Number(state.endurance || 0)
      + (target - from) * engineerEnduranceRegenerationRate(
        context,
        (from + target) / 2,
      ),
  );
  state.enduranceUpdatedAt = target;
  emitEngineerState(context, target, "resources");
}
