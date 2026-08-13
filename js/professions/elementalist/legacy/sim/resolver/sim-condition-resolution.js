import { conditionTickDamage } from "../../../../../platform/gw2/condition-formulas.js";
import { getConditionDurationBonus } from "../../../../../platform/gw2/damage.js";
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from "../../../../../platform/gw2/runtime-rules.js";
import { grantPersistingFlames } from "../mechanics/sim-elemental-traits.js";
import {
  getEmpowermentMultiplier,
  trackEffect,
} from "../mechanics/sim-effect-state.js";
import { trackBlightbringerPoison } from "../mechanics/sim-relic-helpers.js";
import {
  addConditionStack,
  activateConditionTicks,
  countActiveConditionStacks,
  deactivateConditionTicks,
  ensureConditionState,
  getActiveConditionStacks,
  pruneConditionStacks,
  scheduleNextConditionTick,
} from "../state/sim-runtime-state.js";
import { peekConditionState } from "../state/sim-condition-state.js";
import { getRelicState } from "../state/sim-relic-state.js";
import { getEvokerState } from "../state/sim-specialization-state.js";
import {
  isTraitIcdReady,
  armTraitIcd,
  isRelicIcdReady,
  armRelicIcd,
} from "../state/sim-icd-state.js";
import { effectStacksAt } from "../shared/sim-state-queries.js";
import { isPrecombatAt } from "../run/sim-run-phase-state.js";
import {
  addPerSkillCondition,
  pushReportingLog,
  pushReportingStep,
} from "../state/sim-reporting-state.js";

function checkWsBonusWindow(windows, t) {
  if (!windows) return false;
  for (const w of windows) {
    if (t >= w.start && t < w.end) return true;
  }
  return false;
}

function buildConditionTickEffectSnapshot(ctx, ev) {
  const { S } = ctx;
  const evokerState = getEvokerState(S);
  const time = ev.time;
  const effectStacks = (effect) => ctx.effectStacksAt(effect, time);

  return {
    hammerFireOrb: effectStacks("Hammer Orb Fire") > 0 ? 0.05 : 0,
    nourys:
      S.activeRelic === "Nourys" && effectStacks("Nourys") > 0
        ? ctx.getRelicProc("Nourys")?.condDmgA || 0
        : 0,
    tempestuousAria:
      S._hasTempestuousAria && effectStacks("Tempestuous Aria") > 0 ? 0.05 : 0,
    transcendentTempest:
      S._hasTranscendentTempest &&
      !S._suppressTranscendentTempestContributionBuff &&
      effectStacks("Transcendent Tempest") > 0
        ? 0.2
        : 0,
    elementsOfRage:
      S._hasElementsOfRage && effectStacks("Elements of Rage") > 0 ? 0.1 : 0,
    empoweringAuras: S._hasEmpoweringAuras
      ? Math.min(effectStacks("Empowering Auras"), 5) * 0.01
      : 0,
    familiarsProwess:
      S._hasFamiliarsProwess &&
      evokerState.element === "Fire" &&
      effectStacks("Familiar's Prowess") > 0
        ? S._hasFamiliarsFocus
          ? 0.1
          : 0.05
        : 0,
    wsFireBonus: checkWsBonusWindow(S.wsFireBonusWindows, time),
  };
}

function buildInfernoPower(ctx, ev, { basePower, might, empMul }) {
  const { S } = ctx;
  if (!S._hasInferno || ev.cond !== "Burning") return 0;

  const tickAtt = ctx.attAt(ev.time);
  const empFlame = S._hasEmpoweringFlame && tickAtt === "Fire" ? 150 : 0;

  let powerOverwhelming = 0;
  if (S._hasPowerOverwhelming && might >= 10) {
    powerOverwhelming = tickAtt === "Fire" ? 300 : 150;
  }

  let elementalPolyphonyPower = 0;
  if (S._hasElemPolyphony) {
    const tickAtt2 = ctx.att2At(ev.time);
    const atts =
      tickAtt2 !== null ? new Set([tickAtt, tickAtt2]) : new Set([tickAtt]);
    if (atts.has("Fire")) elementalPolyphonyPower = 200;
  }

  const empowermentPower = Math.round((S._empPool?.Power || 0) * empMul);
  return (
    basePower +
    might * MIGHT_ATTRIBUTE_BONUS_PER_STACK +
    empFlame +
    powerOverwhelming +
    elementalPolyphonyPower +
    empowermentPower
  );
}

function buildConditionTickContext(
  ctx,
  ev,
  { might, empMul, condDmg, vulnMul },
) {
  const { engine, basePower, sigilMuls, skipVuln } = ctx;
  const effectSnapshot = buildConditionTickEffectSnapshot(ctx, ev);
  const infernoPower = buildInfernoPower(ctx, ev, {
    basePower,
    might,
    empMul,
  });

  const condMul =
    (1 +
      sigilMuls.condAdd +
      effectSnapshot.hammerFireOrb +
      effectSnapshot.nourys +
      effectSnapshot.tempestuousAria +
      effectSnapshot.transcendentTempest +
      effectSnapshot.elementsOfRage +
      effectSnapshot.empoweringAuras +
      effectSnapshot.familiarsProwess +
      (effectSnapshot.wsFireBonus ? 0.2 : 0)) *
    sigilMuls.condMul *
    vulnMul;

  const diag = engine.fastMode
    ? null
    : {
        condDmg,
        infernoPower,
        condMul,
        sigilCondAdd: sigilMuls.condAdd,
        sigilCondMul: sigilMuls.condMul,
        hammerFireOrb: effectSnapshot.hammerFireOrb,
        nourys: effectSnapshot.nourys,
        tempAria: effectSnapshot.tempestuousAria,
        transcTemp: effectSnapshot.transcendentTempest,
        elemRage: effectSnapshot.elementsOfRage,
        empAuras: effectSnapshot.empoweringAuras,
        famProwess: effectSnapshot.familiarsProwess,
        wsFireBonus: effectSnapshot.wsFireBonus,
        vulnStacks: skipVuln ? 0 : ctx.vulnStacksAt(ev.time),
        vulnMul,
        might,
      };

  return {
    hammerFireOrb: effectSnapshot.hammerFireOrb,
    infernoPower,
    condMul,
    diag,
  };
}

export function handleConditionTickEvent(
  ctx,
  ev,
  { might, empMul, condDmg, vulnMul },
) {
  const tickCtx = buildConditionTickContext(ctx, ev, {
    might,
    empMul,
    condDmg,
    vulnMul,
  });

  procConditionTick(
    ctx,
    ev,
    condDmg,
    tickCtx.condMul,
    tickCtx.infernoPower,
    tickCtx.diag,
  );
}

export function applyCondition(
  engine,
  S,
  cond,
  stacks,
  durSec,
  time,
  skillName,
  castStart = null,
  extraCondDurPct = 0,
  {
    relicProcs = {},
    boons = new Set(),
    damagingConditions = new Set(),
    queueConditionTick = null,
  } = {},
) {
  const evokerState = getEvokerState(S);
  const relicState = getRelicState(S);
  const attrs = engine.attributes.attributes;
  let bonus = getConditionDurationBonus(cond, attrs) + extraCondDurPct;
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
  let uncapped = 0;
  if (S.activeRelic === "Dragonhunter" && relicState.buffUntil > time) {
    uncapped = relicProcs.Dragonhunter.uncappedCondDur;
  }
  const adjMs = Math.round(
    durSec * 1000 * (1 + Math.min(bonus / 100, 1) + uncapped / 100),
  );

  const cs = ensureConditionState(S, cond);

  for (let i = 0; i < stacks; i++) {
    addConditionStack(S, cond, time, time + adjMs, skillName);
  }

  activateConditionTicks(S, cond, time, { queueConditionTick });

  if (damagingConditions.has(cond) && !isPrecombatAt(S, time)) {
    if (S.firstHitTime === null) S.firstHitTime = time;
    S.lastHitTime = time;
  }

  const activeAtTime = countActiveConditionStacks(S, cond, time);
  const effectiveBonus = Math.min(bonus, 100) + uncapped;
  pushReportingLog(S, {
    t: time,
    type: "cond_apply",
    cond,
    stacks,
    durMs: adjMs,
    total: activeAtTime,
    skill: skillName,
    diag: {
      baseDurMs: Math.round(durSec * 1000),
      bonusPct: Math.round(effectiveBonus * 100) / 100,
      uncappedPct: uncapped,
    },
  });

  if (
    S.activeRelic === "Blightbringer" &&
    (cond === "Poisoned" || cond === "Poison")
  ) {
    trackBlightbringerPoison(S, time, skillName, castStart, {
      damagingConditions,
      applyCondition: (nextCond, nextStacks, nextDur, nextTime, source) =>
        applyCondition(
          engine,
          S,
          nextCond,
          nextStacks,
          nextDur,
          nextTime,
          source,
          null,
          0,
          { relicProcs, boons, damagingConditions, queueConditionTick },
        ),
      trackEffect: (effect, effectStacks, effectDur, effectTime) =>
        trackEffect(engine, S, effect, effectStacks, effectDur, effectTime, {
          boons,
          relicProcs,
        }),
    });
  }

  if (S._hasPersistingFlames && cond === "Burning") {
    grantPersistingFlames({ S }, time);
  }

  if (
    evokerState.element === "Fire" &&
    cond === "Burning" &&
    isTraitIcdReady(S, "IgnitePassive", time)
  ) {
    armTraitIcd(S, "IgnitePassive", time, 1000);
    trackEffect(engine, S, "Might", 1, 6, time, { boons, relicProcs });
  }

  if (
    S.activeRelic === "Fractal" &&
    cond === "Bleeding" &&
    isRelicIcdReady(S, "Fractal", time)
  ) {
    const activeStacks = cs.stacks.filter(
      (s) => s.t <= time && s.expiresAt > time,
    ).length;
    if (activeStacks >= 6) {
      armRelicIcd(S, "Fractal", time, relicProcs.Fractal.icd);
      const proc = relicProcs.Fractal;
      for (const [fc, fv] of Object.entries(proc.conditions)) {
        applyCondition(
          engine,
          S,
          fc,
          fv.stacks,
          fv.dur,
          time,
          "Relic of Fractal",
          null,
          0,
          {
            relicProcs,
            boons,
            damagingConditions,
            queueConditionTick,
          },
        );
      }
      pushReportingLog(S, {
        t: time,
        type: "relic_proc",
        relic: "Fractal",
        skill: "Relic of Fractal",
      });
      pushReportingStep(S, {
        skill: "Relic of Fractal",
        start: time,
        end: time,
        att: S.att,
        type: "relic_proc",
        ri: -1,
        icon: proc.icon,
      });
    }
  }
}

export function procConditionTick(
  ctx,
  ev,
  condDmg,
  condMul,
  infernoPower = 0,
  diag = null,
) {
  const { engine, S } = ctx;
  const { cond } = ev;
  const cs = peekConditionState(S, cond);
  if (!cs) return;

  const time = ev.time;
  const allActive = getActiveConditionStacks(S, cond, time);
  const active = allActive.filter((s) => !s.perma);

  if (active.length > 0) {
    const baseTick =
      infernoPower > 0 && cond === "Burning"
        ? 0.0825 * infernoPower + 131
        : conditionTickDamage(cond, condDmg);
    const tick = baseTick * condMul;
    const total = tick * active.length;
    S.totalCond += total;
    if (!engine.fastMode) {
      S.condDamage[cond] = (S.condDamage[cond] || 0) + total;
      S.condStackSeconds[cond] =
        (S.condStackSeconds[cond] || 0) + active.length;
    }

    for (const stack of active) {
      ctx.ensurePerSkill(stack.appliedBy);
      addPerSkillCondition(S, stack.appliedBy, tick);
    }

    pushReportingLog(S, {
      t: time,
      type: "cond_tick",
      cond,
      stacks: active.length,
      perStack: Math.round(tick),
      total: Math.round(total),
      diag: diag
        ? { ...diag, baseTick: Math.round(baseTick * 100) / 100 }
        : null,
    });
  }

  const remaining = pruneConditionStacks(S, cond, time);
  if (remaining.some((s) => !s.perma)) {
    const queueConditionTick =
      typeof ctx.queueConditionTickEvent === "function"
        ? (event) => ctx.queueConditionTickEvent(event)
        : null;
    scheduleNextConditionTick(S, cond, time, { queueConditionTick });
  } else {
    deactivateConditionTicks(S, cond);
  }
}
