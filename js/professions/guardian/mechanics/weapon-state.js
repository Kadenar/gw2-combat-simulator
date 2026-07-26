import { GUARDIAN_SKILL_IDS } from "../data/ids.js";
import { GUARDIAN_AUTOATTACK_CHAINS } from "./autoattack-chains.js";
import { emitGuardianEvent } from "./events.js";
import {
  indexAutoattackChains,
} from "../../../platform/engine/autoattack-chains.js";

const CHAIN_POSITION_BY_SKILL_ID = indexAutoattackChains(
  GUARDIAN_AUTOATTACK_CHAINS,
);

export function validateWeaponState(context, skill) {
  if (
    skill.type === "Weapon"
    && (
      context.state.profession.activeTome
      || context.state.profession.radiantForge
    )
  ) return false;
  if (skill.flipParentId != null) {
    return Number(
      context.state.profession.availableFlips[skill.id] || 0,
    ) > context.start + context.epsilon;
  }
  const chain = CHAIN_POSITION_BY_SKILL_ID.get(skill.id);
  if (!chain) return;
  const expected =
    context.state.profession.autoattackChains[chain.root] || chain.root;
  return expected === skill.id;
}

export function updateWeaponCastState(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const chain = CHAIN_POSITION_BY_SKILL_ID.get(skill.id);
  if (chain) {
    if (chain.next == null) {
      delete context.state.profession.autoattackChains[chain.root];
    } else {
      context.state.profession.autoattackChains[chain.root] = chain.next;
    }
  } else if (skill.type === "Weapon") {
    context.state.profession.autoattackChains = {};
  }

  if (
    skill.flipSkillId != null
    && skill.flipSkillId !== skill.nextChainId
  ) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip?.flipParentId === skill.id) {
      const duration = skill.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME
        ? 3
        : Math.max(1, Number(skill.cooldown || skill.recharge || 5));
      context.state.profession.availableFlips[flip.id] =
        context.effectiveEnd + duration;
    }
  }
  if (skill.flipParentId != null) {
    delete context.state.profession.availableFlips[skill.id];
  }
}

function swapWeapons(context, skill) {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  context.state.profession.autoattackChains = {};
  emitGuardianEvent(context, skill, "weapon_set", { weaponSet });
  return true;
}

export const guardianWeaponSkillHandlers = Object.freeze({
  "guardian.weapon-swap": swapWeapons,
});
