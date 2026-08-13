import {
  getConditionDurationBonus,
  getBoonDurationBonus,
} from "../../../../../platform/gw2/damage.js";
import {
  expireActiveTimedStacks,
  extendActiveTimedStacks,
  extendBoonWindows,
  findActiveTimedStack,
  getActiveTimedStacks,
  pushTimedStack,
  recordEffectWindow,
} from "../state/sim-runtime-state.js";
import {
  isSetupPhase,
  isCombatActiveAt,
  hasExplicitCombatStart,
} from "../run/sim-run-phase-state.js";
import { getRelicState } from "../state/sim-relic-state.js";
import { getEvokerState } from "../state/sim-specialization-state.js";
import { isTraitIcdReady, armTraitIcd } from "../state/sim-icd-state.js";
import { effectStacksAt } from "../shared/sim-state-queries.js";
import { pushReportingLog } from "../state/sim-reporting-state.js";
import {
  adjustChargeCount,
  getChargeState,
  getSkillCooldownMeta,
  getSkillCooldownReadyAt,
  setChargeReadyAt,
  setSkillCooldownReadyAt,
} from "../state/sim-cooldown-state.js";

const FIXED_DURATION_EFFECTS = new Set([
  "Transcendent Tempest",
  "Tempestuous Aria",
]);

const DURATION_STACKING_BOONS = new Set([
  "Alacrity",
  "Fury",
  "Protection",
  "Quickness",
  "Regeneration",
  "Resistance",
  "Resolution",
  "Superspeed",
  "Swiftness",
  "Vigor",
]);
export function refreshEffect(ctx, effectName, durSec, time) {
  const { S } = ctx;
  expireActiveTimedStacks(S, effectName, time);
  ctx.trackEffect(effectName, 1, durSec, time);
}

export function grantFamiliarProwess(ctx, time) {
  const { S } = ctx;
  const existing = findActiveTimedStack(S, "Familiar's Prowess", time, {
    includePerma: false,
  });
  if (existing) {
    existing.expiresAt = Math.min(existing.expiresAt + 5000, time + 15000);
  } else {
    ctx.pushCondStack({
      t: time,
      cond: "Familiar's Prowess",
      expiresAt: time + 5000,
    });
  }
}

function getDisplayedCooldownRemainingMs(meta, time, actualRemainingMs) {
  if (
    !meta ||
    !Number.isFinite(meta.startedAt) ||
    !Number.isFinite(meta.displayDurationMs)
  ) {
    return actualRemainingMs;
  }

  const startedAt = meta.startedAt;
  const displayDurationMs = meta.displayDurationMs;
  const alaUntil = meta.alacrityUntil || 0;
  const elapsedMs = Math.max(0, time - startedAt);
  const alaElapsedMs =
    alaUntil > startedAt
      ? Math.max(0, Math.min(time, alaUntil) - startedAt)
      : 0;
  const displayElapsedMs = elapsedMs + alaElapsedMs * 0.25;
  return Math.max(0, displayDurationMs - displayElapsedMs);
}

export function rechargeWeaponSkills(ctx, pct, time) {
  const { S, skills } = ctx;
  for (const sk of skills) {
    if (sk.type !== "Weapon skill") continue;
    const key = ctx.cdKey(sk);

    if (sk.recharge > 0) {
      const readyAt = getSkillCooldownReadyAt(S, key);
      if (readyAt > time) {
        const baseCdMs = ctx.weaponRechargeMs(
          sk,
          Math.round(sk.recharge * 1000),
        );
        const adjustedCdMs = ctx.alacrityAdjustedCooldown(baseCdMs, time);
        const reducedByMs = Math.round(adjustedCdMs * pct);
        const displayReducedByMs = Math.round(baseCdMs * pct);
        const nextReadyAt = Math.max(time, readyAt - reducedByMs);
        const meta = getSkillCooldownMeta(S, key);
        const actualRemainingMs = Math.max(0, readyAt - time);
        const displayedRemainingMs = getDisplayedCooldownRemainingMs(
          meta,
          time,
          actualRemainingMs,
        );
        const nextDisplayedRemainingMs = Math.max(
          0,
          displayedRemainingMs - displayReducedByMs,
        );
        setSkillCooldownReadyAt(
          S,
          key,
          nextReadyAt,
          nextReadyAt > time
            ? {
                startedAt: time,
                displayDurationMs: nextDisplayedRemainingMs,
                alacrityUntil: S.alacrityUntil || 0,
              }
            : null,
        );
      }
    }

    if (sk.maximumCount > 0 && sk.countRecharge > 0) {
      const chargeState = getChargeState(S, key);
      if (
        !chargeState ||
        chargeState.count >= sk.maximumCount ||
        chargeState.nextChargeAt <= time
      )
        continue;

      const baseChargeMs = ctx.weaponRechargeMs(
        sk,
        Math.round(sk.countRecharge * 1000),
      );
      const adjustedChargeMs = ctx.alacrityAdjustedCooldown(baseChargeMs, time);
      const reducedByMs = Math.round(adjustedChargeMs * pct);
      const nextChargeAt = Math.max(
        time,
        chargeState.nextChargeAt - reducedByMs,
      );

      if (nextChargeAt > time) {
        setChargeReadyAt(S, key, nextChargeAt);
        continue;
      }

      adjustChargeCount(S, key, 1);
      if (chargeState.count < sk.maximumCount) {
        setChargeReadyAt(
          S,
          key,
          time + ctx.alacrityAdjustedCooldown(baseChargeMs, time),
        );
      } else {
        setChargeReadyAt(S, key, Infinity);
      }
    }
  }
}

export function triggerAttunementEnterEffects(ctx, element, time) {
  const { S } = ctx;
  const evokerState = getEvokerState(S);
  const combatActive = isCombatActiveAt(S, time);
  if (element === "Fire") ctx.triggerSunspot(time);
  if (element === "Air") {
    ctx.triggerElectricDischarge(time);
    if (S._hasOneWithAir) ctx.trackEffect("Superspeed", 1, 3, time);
    if (S._hasInscription) ctx.trackEffect("Resistance", 1, 3, time);
    if (S._hasFreshAir) ctx.applyFreshAirBuff(time);
  }
  if (element === "Water") {
    if (S._hasLatentStamina && ctx.traitIcdReady("LatentStamina", time)) {
      ctx.armTraitIcd("LatentStamina", time, 10000);
      ctx.trackEffect("Vigor", 1, 3, time);
    }
  }
  if (element === "Earth") {
    ctx.triggerEarthenBlast(time);
    if (S._hasRockSolid) ctx.grantRockSolid(time);
  }
  if (combatActive && S._hasElemDynamo && element === evokerState.element) {
    const maxCh = S._hasSpecializedElements ? 4 : 6;
    const prevCharges = evokerState.charges;
    const nextCharges = ctx.grantEvokerCharges(1, maxCh);
    if (nextCharges !== prevCharges) {
      ctx.log({
        t: time,
        type: "evoker_charges",
        skill: "Elemental Dynamo",
        source: "trait",
        amount: nextCharges - prevCharges,
        prevCharges,
        charges: nextCharges,
        maxCharges: maxCh,
      });
    }
  }
  if (combatActive && S._hasElemBalance && element === evokerState.element) {
    const eb = ctx.incrementEvokerElemBalance(time, {
      activateEvery: 2,
      durationMs: 5000,
    });
    if (eb.activated) {
      ctx.log({
        t: time,
        type: "skill_proc",
        skill: "Elemental Balance",
        detail: "CDR armed (5s)",
      });
    }
  }
}

export function getEmpowermentMultiplier(ctx, time) {
  const { S } = ctx;
  const stacks = Math.min(
    ctx.effectStacksAt("Elemental Empowerment", time),
    10,
  );
  if (stacks === 0) return 0;
  if (S._hasEmpoweredEmpowerment) return stacks === 10 ? 0.2 : stacks * 0.015;
  return stacks * 0.01;
}

export function grantElementalEmpowerment(ctx, stacks, time, source) {
  const { S } = ctx;
  if (isSetupPhase(S)) return;
  if (!isCombatActiveAt(S, time)) return;
  const active = getActiveTimedStacks(S, "Elemental Empowerment", time);
  const current = Math.min(active.length, 10);
  const toAdd = Math.min(stacks, 10 - current);
  const toReplace = stacks - toAdd;

  if (toReplace > 0) {
    active.sort((a, b) => a.expiresAt - b.expiresAt);
    for (let i = 0; i < toReplace; i++) {
      active[i].expiresAt = time;
      ctx.pushCondStack({
        t: time,
        cond: "Elemental Empowerment",
        expiresAt: time + 15000,
      });
    }
  }
  for (let i = 0; i < toAdd; i++) {
    ctx.pushCondStack({
      t: time,
      cond: "Elemental Empowerment",
      expiresAt: time + 15000,
    });
  }
  if (toAdd + toReplace > 0 && source) {
    ctx.log({
      t: time,
      type: "apply",
      effect: "Elemental Empowerment",
      stacks: toAdd + toReplace,
      dur: 15,
      skill: source,
    });
  }
}

export function applyBoonExtension(S, durSec, time, { boons }) {
  const extMs = Math.round(durSec * 1000);
  for (const boon of boons) {
    extendActiveTimedStacks(S, boon, time, extMs);
  }
  extendBoonWindows(S, time, extMs);
}

export function trackEffect(
  engine,
  S,
  effect,
  stacks,
  durSec,
  time,
  {
    boons,
    relicProcs,
    log = (entry) => pushReportingLog(S, entry),
    pushCondStack = (entry) => pushTimedStack(S, entry),
    gainEndurance = null,
    applyCondition = null,
  },
) {
  const relicState = getRelicState(S);
  const attrs = engine.attributes.attributes;
  const applyConditionFn =
    typeof applyCondition === "function"
      ? applyCondition
      : typeof engine._applyCondition === "function"
        ? (
            cond,
            nextStacks,
            nextDur,
            at,
            skillName,
            castStart = null,
            extraCondDurPct = 0,
          ) =>
            engine._applyCondition(
              S,
              cond,
              nextStacks,
              nextDur,
              at,
              skillName,
              castStart,
              extraCondDurPct,
            )
        : null;
  let bonus = 0;
  let uncapped = 0;

  if (FIXED_DURATION_EFFECTS.has(effect)) {
    // Trait buffs with fixed durations — no scaling from Expertise or Condition Duration
  } else if (boons.has(effect)) {
    bonus = getBoonDurationBonus(effect, attrs);
    if (S._empPool?.Concentration) {
      bonus +=
        (S._empPool.Concentration *
          getEmpowermentMultiplier(
            {
              S,
              effectStacksAt: (name, at) => effectStacksAt(S, name, at),
            },
            time,
          )) /
        15;
    }
    if (
      (S.weaveSelfVisited.has("Water") && time < S.weaveSelfUntil) ||
      time < S.perfectWeaveUntil
    ) {
      bonus += 20;
    }
  } else {
    bonus = getConditionDurationBonus(effect, attrs);
    if (S._hasPiercingShards && effect === "Vulnerability") bonus += 33;
    if (S._empPool?.Expertise) {
      bonus +=
        (S._empPool.Expertise *
          getEmpowermentMultiplier(
            {
              S,
              effectStacksAt: (name, at) => effectStacksAt(S, name, at),
            },
            time,
          )) /
        15;
    }
    if (
      S.activeRelic === "Aristocracy" &&
      relicState.aristocracyStacks > 0 &&
      relicState.aristocracyUntil > time
    ) {
      bonus +=
        relicState.aristocracyStacks * relicProcs.Aristocracy.condDurPerStack;
    }
    if (S.activeRelic === "Dragonhunter" && relicState.buffUntil > time) {
      uncapped = relicProcs.Dragonhunter.uncappedCondDur;
    }
  }

  const adjMs = Math.round(
    durSec * 1000 * (1 + Math.min(bonus / 100, 1) + uncapped / 100),
  );
  if (boons.has(effect) && DURATION_STACKING_BOONS.has(effect)) {
    const active = getActiveTimedStacks(S, effect, time, {
      includePerma: false,
    });
    const carryoverMs = active.reduce(
      (sum, stack) => sum + Math.max(0, stack.expiresAt - time),
      0,
    );
    for (const stack of active) stack.expiresAt = time;

    const expiresAt = time + carryoverMs + adjMs * stacks;
    pushCondStack({ t: time, cond: effect, expiresAt });
    recordEffectWindow(S, effect, expiresAt);
    return;
  }

  for (let i = 0; i < stacks; i++) {
    pushCondStack({ t: time, cond: effect, expiresAt: time + adjMs });
  }

  if (effect === "Vigor" && S._hasLatentStamina && gainEndurance) {
    gainEndurance(10 * stacks, time);
  }

  recordEffectWindow(S, effect, time + adjMs);

  if (
    S._hasStrengthOfStone &&
    effect === "Immobilize" &&
    isCombatActiveAt(S, time) &&
    isTraitIcdReady(S, "StrengthOfStone", time) &&
    applyConditionFn
  ) {
    armTraitIcd(S, "StrengthOfStone", time, 3000);
    applyConditionFn("Bleeding", 3, 10, time, "Strength of Stone");
    log({
      t: time,
      type: "trait_proc",
      trait: "Strength of Stone",
      skill: "Strength of Stone",
    });
  }

  if (
    S._hasViciousEmpowerment &&
    effect === "Immobilize" &&
    isTraitIcdReady(S, "ViciousEmp", time)
  ) {
    armTraitIcd(S, "ViciousEmp", time, 250);
    grantElementalEmpowerment(
      {
        S,
        pushCondStack,
        log,
      },
      2,
      time,
      "Vicious Empowerment",
    );
    trackEffect(engine, S, "Might", 2, 10, time, { boons, relicProcs });
  }
}

export function activateCombatStartEffects(
  S,
  time,
  { pushCondStack = (entry) => pushTimedStack(S, entry) } = {},
) {
  if (!hasExplicitCombatStart(S) || !S._hasElemEmpowermentTrait) return;

  for (let i = 0; i < 3; i++) {
    pushCondStack({
      t: time,
      cond: "Elemental Empowerment",
      expiresAt: 999999999,
      perma: true,
    });
  }
}
