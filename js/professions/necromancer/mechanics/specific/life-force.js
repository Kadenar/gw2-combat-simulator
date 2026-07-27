/**
 * Life-force resource clock and cast finalization.
 *
 * `advanceNecromancerState` integrates everything that happens between two
 * points in time: shroud life-force drain (and auto-exit on depletion),
 * Harbinger blight accrual, Signet of Undeath/Vampirism passives, Eternal Life
 * regen, Lingering Spirits upkeep, and Lich Form expiry. `leaveShroud` performs
 * the shroud-exit bookkeeping (recharge, Soul Barbs, weapon swap). `finalize-
 * NecromancerCast` runs after each cast to advance the clock and apply skill
 * life-force gain. Called on a tight loop, so it stays allocation-light.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { syncNecromancerResources } from "../../state.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../skill-mechanics.js";
import {
  ENTRY_ID_BY_SHROUD,
  EXIT_ID_BY_SHROUD,
  addBlight,
  emitDamage,
  emitState,
  gainNecromancerLifeForce,
  hasTrait,
  purgeTimedState,
} from "./shared.js";

const SHROUD_DRAIN_PER_SECOND = Object.freeze({
  death: 3,
  reaper: 4,
  harbinger: 5,
  ritualist: 3,
});

function targetConditionCount(config = {}) {
  return Object.values(config.target?.conditions || {})
    .filter(value => value === true || Number(value) > 0)
    .length;
}

function targetBoonCount(config = {}) {
  if (config.target?.boonless) return 0;
  if (Array.isArray(config.target?.boons)) return config.target.boons.length;
  return Math.max(0, Number(config.target?.boonCount || 1));
}

function alacrityRecharge(context, duration) {
  return duration / (context.hasBuff?.("alacrity", context.effectiveEnd) ? 1.25 : 1);
}

function setShroudRecharge(context, shroud, at) {
  const entryId = ENTRY_ID_BY_SHROUD[shroud];
  if (entryId != null) {
    context.state.cooldowns.set(
      entryId,
      at + alacrityRecharge(context, 10),
    );
  }
}

function clearSpiritsUnlessLingering(context) {
  if (hasTrait(context, TRAIT.LINGERING_SPIRITS)) return;
  context.state.profession.activeSpirits = {};
}

export function leaveShroud(context, at, reason = "shroud-exit") {
  const state = context.state.profession;
  const shroud = state.activeShroud;
  if (!shroud || shroud === "lich") return;
  state.activeShroud = "";
  state.shroudEnteredAt = 0;
  state.nextBlightAt = Number.POSITIVE_INFINITY;
  const exitId = EXIT_ID_BY_SHROUD[shroud];
  if (exitId != null) {
    delete state.availableFlips[exitId];
    delete state.availableFlips[String(exitId)];
  }
  if (shroud === "ritualist") clearSpiritsUnlessLingering(context);
  context.state.cooldowns.delete(ID.ISOLATE);
  setShroudRecharge(context, shroud, at);
  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.SOUL_BARBS,
      actorType: "player",
      kind: "necromancer-soul-barbs",
      duration: 15,
      stacks: 1,
    });
  }
  context.emit({
    type: "weapon_set",
    at,
    source: "necromancer",
    sourceId: `necromancer.${reason}`,
    actorType: "player",
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true,
  });
  emitState(context, at, reason);
}

function activeSignetOfUndeath(context) {
  return (context.config?.selectedSkills || [])
    .includes("Signet of Undeath");
}

function activeSignetOfVampirism(context) {
  return (context.config?.selectedSkills || [])
    .includes("Signet of Vampirism");
}

export function advanceNecromancerState(context, target) {
  const state = context.state.profession;
  const start = Number(state.lastResourceAt || 0);
  const end = Math.max(start, Number(target || 0));
  purgeTimedState(state, end);

  if (activeSignetOfUndeath(context)) {
    while (state.signetNextLifeForceAt <= end + context.epsilon) {
      if (state.signetNextLifeForceAt > start + context.epsilon) {
        gainNecromancerLifeForce(
          context,
          4,
          state.signetNextLifeForceAt,
        );
      }
      state.signetNextLifeForceAt += 3;
    }
  }

  if (activeSignetOfVampirism(context)) {
    const cooldownReadyAt =
      Number(context.state.cooldowns.get(ID.SIGNET_OF_VAMPIRISM) || 0);
    const passiveWhileRecharging =
      hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING)
      && Boolean(state.activeShroud);
    while (state.vampirismNextAt <= end + context.epsilon) {
      if (
        state.vampirismNextAt > start + context.epsilon
        && (
          cooldownReadyAt <= state.vampirismNextAt + context.epsilon
          || passiveWhileRecharging
        )
      ) {
        const skill =
          context.catalog.skillsById.get(ID.SIGNET_OF_VAMPIRISM);
        const passive = MECHANICS.signetOfVampirism.passive;
        emitDamage(context, skill, 0, {
          at: state.vampirismNextAt,
          name: "Signet of Vampirism — Passive Life Siphon",
          skillWeapon: "Unequipped",
          metadata: {
            flatStrikeBase: passive.flatStrikeBase,
            flatStrikePowerCoeff: passive.flatStrikePowerCoeff,
            noCrit: true,
            damageKind: "life-steal",
          },
        });
      }
      state.vampirismNextAt += MECHANICS.signetOfVampirism.passive.interval;
    }
  }

  if (
    !state.activeShroud
    && hasTrait(context, TRAIT.ETERNAL_LIFE)
  ) {
    const seconds = Math.max(0, Math.floor(end) - Math.floor(start));
    const threshold = state.maximumLifeForce * 0.66;
    state.lifeForce = Math.min(
      threshold,
      state.lifeForce + seconds * 3,
    );
  }

  if (state.activeShroud && state.activeShroud !== "lich") {
    const shroud = state.activeShroud;
    const rate = SHROUD_DRAIN_PER_SECOND[shroud] || 0;
    const elapsed = end - start;
    const potentialDrain = rate * elapsed;
    const exitAt = potentialDrain >= state.lifeForce && rate > 0
      ? start + state.lifeForce / rate
      : end;

    if (shroud === "harbinger") {
      const stacksPerSecond = hasTrait(context, TRAIT.DOOM_APPROACHES) ? 4 : 2;
      while (state.nextBlightAt <= exitAt + context.epsilon) {
        addBlight(state, stacksPerSecond, state.nextBlightAt);
        state.nextBlightAt += 1;
      }
    }
    state.lifeForce = Math.max(
      0,
      state.lifeForce - rate * (exitAt - start),
    );
    syncNecromancerResources(state);
    if (state.lifeForce <= context.epsilon) {
      state.lifeForce = 0;
      leaveShroud(context, exitAt, "life-force-depleted");
    }
  } else if (
    !state.activeShroud
    && Object.keys(state.activeSpirits || {}).length
    && hasTrait(context, TRAIT.LINGERING_SPIRITS)
  ) {
    state.lifeForce = Math.max(0, state.lifeForce - 3 * (end - start));
    if (state.lifeForce <= context.epsilon) {
      state.lifeForce = 0;
      state.activeSpirits = {};
    }
  }

  if (state.activeShroud === "lich" && state.lichEndsAt <= end + context.epsilon) {
    state.activeShroud = "";
    state.lichEndsAt = 0;
    delete state.availableFlips[ID.EXIT_LICH_FORM];
    gainNecromancerLifeForce(context, 15, end);
  }
  state.lastResourceAt = end;
  syncNecromancerResources(state);
  emitState(context, end, "advance");
}

export function applySkillLifeForceGain(context, skill) {
  let amount = Number(skill.lifeForceGain || 0);
  if (skill.categories?.includes("Mark") && hasTrait(context, TRAIT.SOUL_MARKS)) {
    amount += 3;
  }
  if ([ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS].includes(skill.id)) {
    amount += Math.min(5, targetConditionCount(context.config));
  }
  if (skill.id === 10529 && targetBoonCount(context.config) === 0) {
    amount = 0;
  }
  if (amount > 0) {
    gainNecromancerLifeForce(
      context,
      amount,
      context.effectiveEnd,
      "skill-life-force",
    );
  }
}

export function finalizeNecromancerCast(context, skill) {
  advanceNecromancerState(context, context.effectiveEnd);
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  applySkillLifeForceGain(context, skill);
  const state = context.state.profession;
  if (state.pendingShroudEntryId === skill.id) {
    context.state.cooldowns.set(skill.id, Number.POSITIVE_INFINITY);
    delete state.pendingShroudEntryId;
  }
  if (state.pendingSoulTwistSkill === skill.id) {
    context.state.cooldowns.delete(skill.id);
    delete state.pendingSoulTwistSkill;
  }
  emitState(context, context.effectiveEnd, "after-cast");
}
