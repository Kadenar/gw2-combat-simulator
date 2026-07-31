import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";
import { updateSpearChainState } from "./conditions.js";

function enterStealthFromSkill(context, skill, at) {
  const duration = (skill.effects || [])
    .filter(effect =>
      effect.type === "buff" && effect.kind === "stealth")
    .reduce((sum, effect) => sum + Number(effect.duration || 0), 0);
  if (!(duration > 0)) return;
  const state = professionCoreState(context);
  if (state.revealedUntil > at) return;
  const entering = state.stealthUntil <= at;
  state.stealthUntil = Math.min(
    at + 15,
    Math.max(at, state.stealthUntil) + duration,
  );
  if (
    entering
    && hasThiefTrait(context.config, TRAIT.SHADOWS_REJUVENATION)
  ) {
    gainThiefInitiative(context, 2, at, "enter-stealth");
  }
  if (entering && hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    state.spiderVenomCharges = Math.min(
      6,
      Number(state.spiderVenomCharges || 0) + 3,
    );
    state.spiderVenomExpiresAt = at + 24;
    state.spiderVenomGeneration += 1;
  }
  if (entering && hasThiefTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)) {
    context.emit({
      type: "condition",
      at,
      source: "Trait",
      sourceId: TRAIT.CLOAKED_IN_SHADOW,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Cloaked in Shadow — Blindness",
      condition: "Blindness",
      stacks: 1,
      duration: 5,
    });
  }
  emitThiefState(context, at, "stealth");
}

export function updateThiefWeaponState(context, skill) {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
  enterStealthFromSkill(context, skill, at);
  updateSpearChainState(context, skill, at);
  if (skill.dualWieldOpener && skill.flipSkillId != null) {
    state.availableFlips[skill.flipSkillId] = at + 4;
    emitThiefState(context, at, "dual-wield-follow-up");
  }
  if (skill.dualWieldFollowup) {
    delete state.availableFlips[skill.id];
    emitThiefState(context, at, "dual-wield-follow-up-used");
  }
}
