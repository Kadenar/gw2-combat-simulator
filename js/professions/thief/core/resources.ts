import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import { emitThiefState, gainThiefInitiative } from "./shared.js";
import type {
  ThiefPrecastContext,
  ThiefCoreState,
  ThiefResourceContext,
  ThiefSchedulerContext,
  ThiefSkill,
} from "../types.js";

const ENDURANCE_REGENERATION_PER_SECOND = 5;
const VIGOR_ENDURANCE_REGENERATION_MULTIPLIER = 1.5;
const MAXIMUM_ENDURANCE_REGENERATION_PER_SECOND = 10;
const INITIATIVE_REGENERATION_PER_SECOND = 1;
const KNEELING_INITIATIVE_REGENERATION_PER_SECOND = 1 / 3;

export function thiefInitiativeRegenerationRate(
  state: Pick<ThiefCoreState, "kneeling">,
): number {
  return (
    INITIATIVE_REGENERATION_PER_SECOND +
    (state.kneeling ? KNEELING_INITIATIVE_REGENERATION_PER_SECOND : 0)
  );
}

export function thiefEnduranceRegenerationRate(
  context: ThiefResourceContext,
  at = Number(context.start ?? context.state?.time ?? 0),
): number {
  const vigorActive = Boolean(
    context.config?.boons?.vigor || context.hasBuff?.("vigor", at),
  );
  return Math.min(
    MAXIMUM_ENDURANCE_REGENERATION_PER_SECOND,
    ENDURANCE_REGENERATION_PER_SECOND *
      (vigorActive ? VIGOR_ENDURANCE_REGENERATION_MULTIPLIER : 1),
  );
}

export function thiefEnduranceReadyAt(
  context: ThiefPrecastContext,
  cost: number,
): number | null {
  const current = Number(professionCoreState(context).endurance || 0);
  const required = Math.max(0, Number(cost || 0));
  const missing = required - current;
  if (missing <= Number(context.epsilon || 0.0001)) return context.start;
  const rate = thiefEnduranceRegenerationRate(context, context.start);
  return rate > 0 ? context.start + missing / rate : null;
}

export function advanceThiefCoreResources(
  context: ThiefSchedulerContext,
  target: number,
): void {
  const state = professionCoreState(context);
  state.leadAttackExpirations = (state.leadAttackExpirations || []).filter(
    (expiresAt) => Number(expiresAt) > target,
  );
  state.leadAttacksStacks = state.leadAttackExpirations.length;
  state.leadAttacksUntil = state.leadAttackExpirations.length
    ? Math.max(...state.leadAttackExpirations)
    : 0;
  if (Number(state.spiderVenomExpiresAt || 0) <= target) {
    state.spiderVenomCharges = 0;
  }
  if (
    state.activeThievesGuild &&
    Number(state.activeThievesGuild.expiresAt || 0) <= target
  ) {
    state.activeThievesGuild = null;
  }
  for (const [skillId, expiresAt] of Object.entries(state.availableFlips)) {
    if (Number(expiresAt || 0) <= target) delete state.availableFlips[skillId];
  }
  const initiativeFrom = Number(state.initiativeUpdatedAt || 0);
  if (target > initiativeFrom) {
    state.initiative = Math.min(
      state.maximumInitiative,
      state.initiative +
        (target - initiativeFrom) * thiefInitiativeRegenerationRate(state),
    );
    state.initiativeUpdatedAt = target;
  }
  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  if (target > enduranceFrom) {
    state.endurance = Math.min(
      state.maximumEndurance,
      state.endurance +
        (target - enduranceFrom) *
          thiefEnduranceRegenerationRate(context, (enduranceFrom + target) / 2),
    );
    state.enduranceUpdatedAt = target;
  }
  emitThiefState(context, target, "resources");
}

export function spendThiefCoreResources(
  context: ThiefPrecastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0) {
    state.initiative = Math.max(0, state.initiative - cost);
    emitThiefState(context, context.start, "initiative-spent");
  }
  if (
    (skill.categories || []).some((category) =>
      String(category).toLowerCase().includes("signet"),
    ) &&
    hasThiefTrait(context.config, TRAIT.SIGNETS_OF_POWER)
  ) {
    gainThiefInitiative(context, 3, context.start, "signets-of-power");
  }
}
