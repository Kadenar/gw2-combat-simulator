import { hasTrait as hasGw2Trait } from "../../../../platform/gw2/trait-state.js";
import type { Skill } from "../../../../platform/engine/types.js";
import type { ElementalistCastContext } from "../../types.js";
import { emitElementalistBuff } from "../../core/mechanics.js";
import { elementalistBalanceEffect } from "../../core/profiles.js";
import { ALTRUISTIC_ASPECT_BOONS } from "./constants.js";
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

export function applyAltruisticAspect(
  context: ElementalistCastContext,
  skill: Skill,
): void {
  if (!hasTrait(context, "Altruistic Aspect")) return;
  const boon = ALTRUISTIC_ASPECT_BOONS.get(skill.id);
  if (!boon) return;
  const effect = elementalistBalanceEffect(
    context,
    PROFILE.altruisticAspect,
    "boon",
    skill.name,
  );
  emitElementalistBuff(
    context as never,
    context.effectiveEnd,
    String(effect?.boon || boon[0]),
    Number(effect?.stacks ?? boon[1]),
    Number(effect?.duration ?? boon[2]),
    skill.name,
    skill.id,
  );
}
