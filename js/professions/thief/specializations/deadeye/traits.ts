import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import { gainThiefInitiative } from "../../core/shared.js";
import type { ThiefCastContext, ThiefEmissionContext } from "../../types.js";
import { deadeyeState } from "./state.js";

export function initialDeadeyeMalice(context: ThiefCastContext): number {
  return hasThiefTrait(context.config, TRAIT.MALICIOUS_INTENT) ? 2 : 0;
}

export function deadeyeStealthAttackMaliceBonus(
  context: ThiefCastContext,
): number {
  return hasThiefTrait(context.config, TRAIT.MALICIOUS_INTENT) ? 2 : 0;
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
  emitDeadeyeBoon(context, at, "Quickness", 4, 1, "Be Quick or Be Killed");
}

export function applyDeadeyeStolenSkillTraits(
  context: ThiefCastContext,
  at: number,
): void {
  if (!hasThiefTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) return;
  emitDeadeyeBoon(context, at, "Might", 12, 8, "Fire for Effect", true);
  emitDeadeyeBoon(context, at, "Fury", 12, 1, "Fire for Effect", true);
}

export function applyMaleficentSeven(
  context: ThiefEmissionContext,
  at: number,
): void {
  const state = deadeyeState.from(context);
  if (
    state.malice !== state.maximumMalice ||
    state.maleficentSevenTriggered ||
    !hasThiefTrait(context.config, TRAIT.MALEFICENT_SEVEN)
  ) {
    return;
  }
  state.maleficentSevenTriggered = true;
  gainThiefInitiative(context, 7, at, "maleficent-seven");
  for (const [boon, duration, stacks] of [
    ["Might", 10, 10],
    ["Fury", 10, 1],
    ["Protection", 5, 1],
    ["Regeneration", 10, 1],
    ["Swiftness", 10, 1],
    ["Vigor", 10, 1],
  ] as const) {
    emitDeadeyeBoon(context, at, boon, duration, stacks, "Maleficent Seven");
  }
}
