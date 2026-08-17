import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import { gainThiefInitiative } from "../../core/shared.js";
import type { ThiefCastContext, ThiefEmissionContext } from "../../types.js";
import { deadeyeState } from "./state.js";
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
} from "../../core/profiles.js";
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";

// Starting malice when Deadeye's Mark is applied to a fresh target (Malicious Intent: 2, otherwise: 0)
export function initialDeadeyeMalice(context: ThiefCastContext): number {
  return hasThiefTrait(context.config, TRAIT.MALICIOUS_INTENT)
    ? Number(
        thiefBalanceProfile(context, PROFILE.maliciousIntent)?.resourceGain ||
          2,
      )
    : 0;
}

// Additional malice added to the snapshot before a stealth attack resolves (same trait, same value — two separate game effects)
export function deadeyeStealthAttackMaliceBonus(
  context: ThiefCastContext,
): number {
  return initialDeadeyeMalice(context);
}

export function emitDeadeyeBoon(
  context: ThiefEmissionContext,
  at: number,
  boon: string,
  duration: number,
  stacks = 1,
  source = "Deadeye",
  party = false,
): void {
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: `thief.deadeye.${source.toLowerCase().replaceAll(" ", "-")}`,
    actorType: "player",
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name: `${source} — ${boon}`,
    kind: boon.toLowerCase(),
    boon,
    duration,
    stacks,
    ...(party ? { recipients: "party", maximumRecipients: 5 } : {}),
  });
}

export function applyDeadeyesMarkTraits(
  context: ThiefCastContext,
  at: number,
): void {
  if (!hasThiefTrait(context.config, TRAIT.BE_QUICK_OR_BE_KILLED)) return;
  const quickness = thiefBalanceProfileEffect(
    thiefBalanceProfile(context, PROFILE.beQuickOrBeKilled),
    "boon",
  );
  emitDeadeyeBoon(
    context,
    at,
    String(quickness?.boon || "Quickness"),
    Number(quickness?.duration || 4),
    Number(quickness?.stacks || 1),
    "Be Quick or Be Killed",
  );
}

export function applyDeadeyeStolenSkillTraits(
  context: ThiefCastContext,
  at: number,
): void {
  if (!hasThiefTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) return;
  const profile = thiefBalanceProfile(context, PROFILE.fireForEffect);
  for (const effect of (profile?.effects || []).filter(
    (entry) => entry.type === "boon",
  )) {
    emitDeadeyeBoon(
      context,
      at,
      String(effect.boon || effect.kind || ""),
      Number(effect.duration || 12),
      Number(effect.stacks || 1),
      "Fire for Effect",
      true,
    );
  }
}

export function applyMaleficentSeven(
  context: ThiefEmissionContext,
  at: number,
): void {
  const state = deadeyeState.from(context);
  if (
    state.malice !== state.maximumMalice ||
    // maleficentSevenTriggered prevents the proc from firing again if malice stays at maximum across multiple hits
    state.maleficentSevenTriggered ||
    !hasThiefTrait(context.config, TRAIT.MALEFICENT_SEVEN)
  ) {
    return;
  }
  state.maleficentSevenTriggered = true;
  const profile = thiefBalanceProfile(context, PROFILE.maleficentSeven);
  gainThiefInitiative(
    context,
    Number(profile?.resourceGain || 7),
    at,
    "maleficent-seven",
  );
  for (const effect of (profile?.effects || []).filter(
    (entry) => entry.type === "boon",
  )) {
    emitDeadeyeBoon(
      context,
      at,
      String(effect.boon || effect.kind || ""),
      Number(effect.duration || 0),
      Number(effect.stacks || 1),
      "Maleficent Seven",
    );
  }
}
