import { enqueueHitEvent } from "../shared/sim-events.js";
import { getProcState } from "../state/sim-proc-state.js";
import {
  findActiveTimedStack,
  pushTimedStack,
} from "../state/sim-runtime-state.js";
import { isCombatActiveAt } from "../run/sim-run-phase-state.js";

function queueSigilHit(ctx, event) {
  if (ctx.queueHitEvent) return ctx.queueHitEvent(event);
  return enqueueHitEvent(ctx.S.eq, event);
}

function logSigilProc(ctx, name, time, icon) {
  const { S } = ctx;
  ctx.log({
    t: time,
    type: "sigil_proc",
    sigil: name,
    skill: `Sigil of ${name}`,
  });
  ctx.addStep({
    skill: `Sigil of ${name}`,
    start: time,
    end: time,
    att: S.att,
    type: "sigil_proc",
    ri: -1,
    icon,
  });
}

function refreshSingleEffectStack(S, effect, time, durationMs) {
  const existing = findActiveTimedStack(S, effect, time, {
    includePerma: false,
  });
  if (existing) existing.expiresAt = time;
  pushTimedStack(S, { t: time, cond: effect, expiresAt: time + durationMs });
}

export function checkOnCritSigils(ctx, time, critChancePct) {
  const { S, sigilProcs = {}, activeProcSigils = [] } = ctx;
  const procState = getProcState(S);
  const critSigils = activeProcSigils.filter(
    (name) => sigilProcs[name].trigger === "crit",
  );
  if (critSigils.length === 0 || critChancePct <= 0) return;

  procState.sigilCritAccum += critChancePct / 100;
  if (procState.sigilCritAccum < 1) return;
  procState.sigilCritAccum -= 1;

  for (const name of critSigils) {
    const proc = sigilProcs[name];
    if (!ctx.sigilIcdReady(name, time)) continue;
    ctx.armSigilIcd(name, time, proc.icd);

    if (proc.effect === "strike") {
      queueSigilHit(ctx, {
        time,
        skill: `Sigil of ${name}`,
        hitIdx: 1,
        sub: 1,
        totalSubs: 1,
        dmg: proc.coeff,
        ws: proc.ws,
        isField: false,
        cc: false,
        conds: null,
        isSigilProc: true,
        noCrit: !proc.canCrit,
        att: S.att,
      });
    } else if (proc.effect === "condition") {
      ctx.applyCondition(
        proc.cond,
        proc.stacks,
        proc.dur,
        time,
        `Sigil of ${name}`,
      );
    }

    logSigilProc(ctx, name, time, proc.icon);
  }
}

export function checkBurningPrecision(ctx, time, critChancePct) {
  const { S } = ctx;
  const procState = getProcState(S);
  if (critChancePct <= 0) return;
  procState.traitBurnPrecAccum += (critChancePct / 100) * 0.33;
  if (procState.traitBurnPrecAccum < 1) return;
  if (!ctx.traitIcdReady("BurningPrecision", time)) return;

  procState.traitBurnPrecAccum -= 1;
  ctx.armTraitIcd("BurningPrecision", time, 5000);
  ctx.applyCondition("Burning", 1, 3, time, "Burning Precision");
  ctx.log({
    t: time,
    type: "trait_proc",
    trait: "Burning Precision",
    skill: "Burning Precision",
  });
  ctx.addStep({
    skill: "Burning Precision",
    start: time,
    end: time,
    att: S.att,
    type: "trait_proc",
    ri: -1,
    icon: "https://render.guildwars2.com/file/774471FA3841BB90EB6F935A76D8017A0C4B005E/1012306.png",
  });
}

export function checkArcanePrecision(ctx, time, critChancePct, attunement) {
  const { S } = ctx;
  const procState = getProcState(S);
  if (critChancePct <= 0) return;
  procState.traitArcanePrecAccum += (critChancePct / 100) * 0.33;
  if (procState.traitArcanePrecAccum < 1) return;
  if (!ctx.traitIcdReady("ArcanePrecision", time)) return;

  procState.traitArcanePrecAccum -= 1;
  ctx.armTraitIcd("ArcanePrecision", time, 3000);
  if (attunement === "Fire")
    ctx.applyCondition("Burning", 1, 1.5, time, "Arcane Precision");
  else if (attunement === "Water")
    ctx.trackEffect("Vulnerability", 1, 10, time);
  else if (attunement === "Air") ctx.trackEffect("Weakness", 1, 3, time);
  else if (attunement === "Earth")
    ctx.applyCondition("Bleeding", 1, 5, time, "Arcane Precision");

  ctx.log({
    t: time,
    type: "trait_proc",
    trait: "Arcane Precision",
    skill: "Arcane Precision",
  });
  ctx.addStep({
    skill: "Arcane Precision",
    start: time,
    end: time,
    att: S.att,
    type: "trait_proc",
    ri: -1,
    icon: "https://render.guildwars2.com/file/1CB6B7903F10246E9405DD625380161FCD4E6C23/1012282.png",
  });
}

export function checkFoodCritProc(ctx, time, critChancePct) {
  const { S } = ctx;
  const proc = S._foodProc;
  if (!proc || critChancePct <= 0) return;
  const procState = getProcState(S);
  procState.foodCritProcAccum += (critChancePct / 100) * proc.chance;
  if (procState.foodCritProcAccum < 1) return;
  if (!ctx.traitIcdReady("FoodCritProc", time)) return;

  procState.foodCritProcAccum -= 1;
  ctx.armTraitIcd("FoodCritProc", time, proc.icdMs);
  queueSigilHit(ctx, {
    time,
    skill: proc.name,
    hitIdx: 1,
    sub: 1,
    totalSubs: 1,
    dmg: 0,
    ws: 0,
    flatStrikeBase: proc.flatDamage,
    flatStrikePowerCoeff: 0,
    isField: false,
    cc: false,
    conds: null,
    noCrit: true,
    att: ctx.attAt(time),
    att2: ctx.att2At(time),
    castStart: time,
    isFoodProc: true,
  });
  ctx.log({ t: time, type: "food_proc", skill: proc.name });
}

export function checkRenewingStamina(ctx, time, critChancePct) {
  const { S } = ctx;
  const procState = getProcState(S);
  if (critChancePct <= 0) return;
  procState.traitRenewingStaminaAccum += critChancePct / 100;
  if (procState.traitRenewingStaminaAccum < 1) return;
  if (!ctx.traitIcdReady("RenewingStamina", time)) return;

  procState.traitRenewingStaminaAccum -= 1;
  ctx.armTraitIcd("RenewingStamina", time, 10000);
  ctx.trackEffect("Vigor", 1, 5, time);
}

export function applyElementalAttunementBoon(ctx, attunement, time) {
  if (attunement === "Fire") ctx.trackEffect("Might", 1, 15, time);
  else if (attunement === "Water") ctx.trackEffect("Regeneration", 1, 5, time);
  else if (attunement === "Air") ctx.trackEffect("Swiftness", 1, 8, time);
  else if (attunement === "Earth") ctx.trackEffect("Protection", 1, 5, time);
}

export function getAttunementCooldownMs(S, baseCdMs) {
  let ms = baseCdMs;
  if (S._hasFlowState) ms = Math.max(0, ms - 1000);
  if (S._hasElemEnchantment) ms = Math.round(ms * 0.85);
  return ms;
}

export function refreshArcaneLightningBuff(engine, S, time) {
  const existing = findActiveTimedStack(S, "Arcane Lightning", time, {
    includePerma: false,
  });
  if (existing) existing.expiresAt = time + 15000;
  else
    pushTimedStack(S, {
      t: time,
      cond: "Arcane Lightning",
      expiresAt: time + 15000,
    });
}

export function triggerBountifulPower(ctx, stacks, time) {
  const { S } = ctx;
  const procState = getProcState(S);
  if (!S._hasBountifulPower) return;
  if (!isCombatActiveAt(S, time)) return;
  procState.bountifulPowerStacks += stacks;
  if (procState.bountifulPowerStacks < 5) return;

  procState.bountifulPowerStacks -= 5;
  ctx.trackEffect("Quickness", 1, 5, time);
  ctx.pushCondStack({
    t: time,
    cond: "Bountiful Power Active",
    expiresAt: time + 7000,
  });
  ctx.log({
    t: time,
    type: "skill_proc",
    skill: "Bountiful Power",
    detail: "+20% strike, 5s Quickness",
  });
}

export function procOnSwapSigils(ctx, time) {
  const { S, sigilProcs = {}, activeProcSigils = [] } = ctx;
  if (!isCombatActiveAt(S, time)) return;
  const procState = getProcState(S);
  const swapSigils = activeProcSigils.filter(
    (name) => sigilProcs[name].trigger === "swap",
  );
  for (const name of swapSigils) {
    const proc = sigilProcs[name];
    if (!ctx.sigilIcdReady(name, time)) continue;
    ctx.armSigilIcd(name, time, proc.icd);

    if (proc.effect === "doom") {
      procState.sigilDoomPending = true;
    } else if (proc.effect === "strike_cond") {
      queueSigilHit(ctx, {
        time,
        skill: `Sigil of ${name}`,
        hitIdx: 1,
        sub: 1,
        totalSubs: 1,
        dmg: proc.coeff,
        ws: proc.ws,
        isField: false,
        cc: false,
        conds: { [proc.cond]: { stacks: proc.stacks, duration: proc.dur } },
        isSigilProc: true,
        noCrit: !proc.canCrit,
        att: S.att,
      });
    } else if (proc.effect === "condition") {
      ctx.applyCondition(
        proc.cond,
        proc.stacks,
        proc.dur,
        time,
        `Sigil of ${name}`,
      );
    } else if (proc.effect === "endurance") {
      ctx.gainEndurance(proc.amount, time);
    }

    logSigilProc(ctx, name, time, proc.icon);
  }
}

export function procOnCcSigils(ctx, time) {
  const { S, sigilProcs = {}, activeProcSigils = [] } = ctx;
  if (!isCombatActiveAt(S, time)) return;

  const ccSigils = activeProcSigils.filter(
    (name) => sigilProcs[name].trigger === "cc",
  );
  for (const name of ccSigils) {
    const proc = sigilProcs[name];
    if (!ctx.sigilIcdReady(name, time)) continue;
    ctx.armSigilIcd(name, time, proc.icd);

    if (proc.effect === "buff") {
      refreshSingleEffectStack(S, "Severance", time, proc.dur * 1000);
    }

    logSigilProc(ctx, name, time, proc.icon);
  }
}
