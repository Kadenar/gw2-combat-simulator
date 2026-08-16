import { GUARDIAN_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { buildGuardianStrike } from "../../core/events.js";
import { hasGuardianTrait } from "../../core/traits.js";
import type { GuardianCastContext, GuardianSkill } from "../../types.js";

export function applySoaringDevastation(
  context: GuardianCastContext,
  skill: GuardianSkill,
  skillWeapon: string,
): void {
  if (!hasGuardianTrait(context, TRAIT.SOARING_DEVASTATION)) return;
  const at = context.effectiveEnd;
  // skillWeapon must come from the caller (resolved to the active weapon set)
  // because traits.ts has no direct access to config at emit time.
  context.emit(
    buildGuardianStrike({
      at,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      name: "Wings of Resolve — Soaring Devastation",
      coefficient: 1.5,
      skillWeapon,
    }),
  );
  context.emit({
    type: "condition",
    at,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: "Soaring Devastation — Immobilized",
    condition: "Immobilized",
    stacks: 1,
    duration: 3,
  });
}

export function bigGameHunterTetherDuration(
  context: GuardianCastContext,
): number {
  // Big Game Hunter doubles tether duration (6 → 12s) and is also what
  // unlocks the target-vulnerability buff and the passive Crippled in the resolver.
  return hasGuardianTrait(context, TRAIT.BIG_GAME_HUNTER) ? 12 : 6;
}
