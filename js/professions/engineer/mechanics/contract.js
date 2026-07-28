import {
  ENGINEER_AUTOATTACK_CHAINS,
} from "../catalog.js";
import {
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  hasEngineerTrait,
  snapshotEngineerState,
} from "../state.js";
import { engineerCastAvailability } from "./availability.js";

const CHAIN_BY_ID = new Map();
for (const chain of ENGINEER_AUTOATTACK_CHAINS) {
  chain.forEach((id, index) => CHAIN_BY_ID.set(id, {
    root: chain[0],
    next: chain[index + 1] ?? null,
  }));
}

function emitState(context, at, reason) {
  context.emit({
    type: "engineer.state",
    at,
    source: "engineer",
    sourceId: `engineer.state.${reason}`,
    actorType: "player",
    reason,
    state: snapshotEngineerState(context.state.profession),
  });
}

function emitKitSwap(context, skill, at) {
  context.emit({
    type: "sigil_swap",
    at,
    source: "engineer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
}

function coolInactiveForge(state, target) {
  if (state.photonForgeActive || state.heat <= 0) return;
  const exit = Number(state.forgeExitedAt ?? state.heatUpdatedAt);
  const from = Math.max(Number(state.heatUpdatedAt || 0), exit);
  const slowStart = exit + 3;
  const fastStart = exit + 8;
  const integrate = (start, end, rate) => {
    if (end > start) state.heat -= (end - start) * rate;
  };
  integrate(Math.max(from, slowStart), Math.min(target, fastStart), 5);
  integrate(Math.max(from, fastStart), target, 10);
  state.heat = Math.max(0, state.heat);
  if (state.heat === 0) state.overheated = false;
}

function forceOverheat(context, at) {
  const state = context.state.profession;
  state.heat = state.maximumHeat;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
  state.overheated = true;
  state.activeKit = "";
  const toolbeltPenalty = hasEngineerTrait(
    context.config,
    TRAIT.PHOTONIC_BLASTING_MODULE,
  ) ? 5 : 15;
  for (const skill of context.catalog.skills) {
    if (!skill.toolbeltParentName) continue;
    context.state.cooldowns.set(
      skill.id,
      Math.max(
        Number(context.state.cooldowns.get(skill.id) || 0),
        at + toolbeltPenalty,
      ),
    );
  }
  emitState(context, at, "overheat");
}

export function advanceEngineerState(context, target) {
  const state = context.state.profession;
  const from = Number(state.heatUpdatedAt || 0);
  if (target <= from) return;
  if (state.photonForgeActive) {
    const remaining = state.maximumHeat - state.heat;
    const overheatAt = from + Math.max(0, remaining) / 2;
    if (overheatAt <= target) {
      forceOverheat(context, overheatAt);
      state.heatUpdatedAt = overheatAt;
      coolInactiveForge(state, target);
    } else {
      state.heat += (target - from) * 2;
    }
  } else {
    coolInactiveForge(state, target);
  }
  state.heatUpdatedAt = target;
}

function afterCast(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const chain = CHAIN_BY_ID.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }

  if (skill.kitEquip) {
    const kit = skill.kitName || skill.name;
    state.activeKit = state.activeKit === kit ? "" : kit;
    state.photonForgeActive = false;
    state.forgeExitedAt = at;
    emitKitSwap(context, skill, at);
    emitState(context, at, state.activeKit ? "equip-kit" : "stow-kit");
    return;
  }
  if (skill.kitStow) {
    state.activeKit = "";
    emitKitSwap(context, skill, at);
    emitState(context, at, "stow-kit");
    return;
  }
  if (skill.name === "Engage Photon Forge") {
    state.activeKit = "";
    state.photonForgeActive = true;
    state.forgeExitedAt = null;
    state.kitLockoutUntil = at + 6;
    emitKitSwap(context, skill, at);
    emitState(context, at, "enter-forge");
    return;
  }
  if (skill.name.startsWith("Deactivate Photon Forge")) {
    state.photonForgeActive = false;
    state.forgeExitedAt = at;
    emitKitSwap(context, skill, at);
    emitState(context, at, "exit-forge");
    return;
  }
  if (state.photonForgeActive && Number(skill.heatGain) > 0) {
    state.heat = Math.min(
      state.maximumHeat,
      state.heat + Number(skill.heatGain),
    );
    if (state.heat >= state.maximumHeat) forceOverheat(context, at);
    else emitState(context, at, "heat");
  }
  if (skill.name === "Crash Down") {
    state.mech.active = true;
    emitState(context, at, "summon-mech");
  } else if (skill.name.startsWith("Recall Mech")) {
    state.mech.active = false;
    emitState(context, at, "recall-mech");
  } else if (skill.name === "Evolve") {
    state.evolvedUntil = at + 20;
    emitState(context, at, "evolve");
  }
}

function initialize(context) {
  const state = context.state.profession;
  if (state.mech.enabled && state.mech.active) {
    context.tasks.schedule({
      type: "engineer.mech-attack",
      at: 1,
      ownerId: "engineer.mech",
      payload: {},
    });
  }
}

function handleMechAttack(context, task) {
  const state = context.state.profession;
  if (!state.mech.enabled) return;
  if (state.mech.active) {
    context.emit({
      type: "damage",
      at: task.at,
      source: "engineer",
      sourceId: "engineer.mech-basic-attack",
      actorType: "summon",
      skillName: "Jade Energy Shot",
      name: "Jade Energy Shot",
      coefficient: 0.6,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: "Unequipped",
    });
  }
  state.mech.nextAttackAt = task.at + 1;
  context.tasks.schedule({
    type: "engineer.mech-attack",
    at: state.mech.nextAttackAt,
    ownerId: "engineer.mech",
    payload: {},
  });
}

function modifyRechargeDuration(context, duration) {
  const skill = context.skill;
  if (
    skill?.toolbeltParentName
    && hasEngineerTrait(context.config, TRAIT.MECHANIZED_DEPLOYMENT)
  ) {
    return duration * 0.85;
  }
  if (
    skill?.categories?.some(category =>
      String(category).toLowerCase() === "gadget")
    && hasEngineerTrait(context.config, TRAIT.GADGETEER)
  ) {
    return duration * 0.8;
  }
  return duration;
}

export const engineerCastRules = Object.freeze({
  availability: {
    id: "engineer.availability",
    order: 10,
    handler: engineerCastAvailability,
  },
  modifyRechargeDuration,
});

export const engineerSchedulerHooks = Object.freeze({
  initialize,
  advance: advanceEngineerState,
  afterCast,
  taskHandlers: Object.freeze({
    "engineer.mech-attack": handleMechAttack,
  }),
});
