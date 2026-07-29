import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import {
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

function enterStealthFromSkill(context, skill, at) {
  const duration = (skill.effects || [])
    .filter(effect =>
      effect.type === "buff" && effect.kind === "stealth")
    .reduce((sum, effect) => sum + Number(effect.duration || 0), 0);
  if (!(duration > 0)) return;
  const state = context.state.profession;
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
    gainThiefInitiative(context, 1, at, "enter-stealth");
  }
  emitThiefState(context, at, "stealth");
}

export function updateThiefWeaponState(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
  enterStealthFromSkill(context, skill, at);
  if (skill.dualWieldOpener && skill.flipSkillId != null) {
    state.availableFlips[skill.flipSkillId] = at + 4;
    emitThiefState(context, at, "dual-wield-follow-up");
  }
  if (skill.dualWieldFollowup) {
    delete state.availableFlips[skill.id];
    emitThiefState(context, at, "dual-wield-follow-up-used");
  }
}
