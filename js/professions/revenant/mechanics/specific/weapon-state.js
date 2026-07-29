/**
 * Revenant weapon-chain and temporary flip state.
 *
 * Advances canonical autoattack chains after casts and resets them on other
 * weapon actions. It also owns Imperial Guard's blocking window, the temporary
 * True Strike flip, and the typed task that expires that follow-up.
 */
import { REVENANT_SKILL_IDS as ID } from "../../data/ids.js";
import { emitRevenantState } from "./shared.js";

/** Advances or resets the active weapon autoattack chain after a cast. */
export function updateRevenantWeaponState(context, skill) {
  const state = context.state.profession;
  if (context.action?.cancelled === true) return;
  if (skill.id === ID.ABYSSAL_STRIKE) {
    state.abyssalStrikeSecondCast = !state.abyssalStrikeSecondCast;
  } else if (skill.type === "Weapon" || Number(skill.castTimeMs || 0) > 0) {
    state.abyssalStrikeSecondCast = false;
  }
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon" || Number(skill.castTimeMs || 0) > 0) {
    state.autoattackChains = {};
  }
}

const IMPERIAL_GUARD_OWNER = "revenant.imperial-guard";

/** Arms True Strike and emits Imperial Guard's blocking window at cast start. */
export function beginRevenantWeaponCast(context, skill) {
  if (skill.id !== ID.IMPERIAL_GUARD) return;
  context.state.profession.availableFlips[ID.TRUE_STRIKE] = true;
  context.emit({
    type: "buff",
    at: context.start,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: "Imperial Guard — Blocking",
    kind: "blocking",
    duration: Math.max(0, context.effectiveEnd - context.start),
    stacks: 1,
  });
  emitRevenantState(context, context.start, "imperial-guard");
}

/** Commits or consumes the Imperial Guard/True Strike temporary flip. */
export function completeRevenantWeaponCast(context, skill) {
  const state = context.state.profession;
  if (skill.id === ID.IMPERIAL_GUARD) {
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    context.tasks.schedule({
      type: "revenant.imperial-guard-expire",
      at: context.effectiveEnd + 4,
      ownerId: IMPERIAL_GUARD_OWNER,
      payload: {},
    });
    emitRevenantState(context, context.effectiveEnd, "imperial-guard");
  } else if (skill.id === ID.TRUE_STRIKE) {
    delete state.availableFlips[ID.TRUE_STRIKE];
    context.tasks.cancelOwner(IMPERIAL_GUARD_OWNER);
    emitRevenantState(context, context.effectiveEnd, "true-strike");
  }
}

/** Removes True Strike when the scheduled Imperial Guard window expires. */
export function expireImperialGuard(context, task) {
  delete context.state.profession.availableFlips[ID.TRUE_STRIKE];
  emitRevenantState(context, task.at, "imperial-guard-expired");
}
