import { REVENANT_AUTOATTACK_CHAINS } from "../../catalog.js";
import {
  indexAutoattackChains,
} from "../../../../platform/engine/autoattack-chains.js";
import { REVENANT_SKILL_IDS as ID } from "../../data/ids.js";
import { emitRevenantState } from "./shared.js";

const CHAIN_BY_ID = indexAutoattackChains(REVENANT_AUTOATTACK_CHAINS);

export function updateRevenantWeaponState(context, skill) {
  const state = context.state.profession;
  const chain = CHAIN_BY_ID.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon" || Number(skill.castTimeMs || 0) > 0) {
    state.autoattackChains = {};
  }
}

const IMPERIAL_GUARD_OWNER = "revenant.imperial-guard";

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

export function expireImperialGuard(context, task) {
  delete context.state.profession.availableFlips[ID.TRUE_STRIKE];
  emitRevenantState(context, task.at, "imperial-guard-expired");
}
